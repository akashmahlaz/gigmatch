import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Gig, GigDocument } from '../schemas/gig.schema';
import { Venue, VenueDocument } from '../venues/schemas/venue.schema';
import { Artist, ArtistDocument } from '../artists/schemas/artist.schema';
import { User, UserDocument } from '../schemas/user.schema';

import {
  CreateGigDto,
  UpdateGigDto,
  ApplyToGigDto,
  DiscoverGigsDto,
} from './dto/gig.dto';

type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pages: number;
};

@Injectable()
export class GigsService {
  constructor(
    @InjectModel(Gig.name) private readonly gigModel: Model<GigDocument>,
    @InjectModel(Venue.name) private readonly venueModel: Model<VenueDocument>,
    @InjectModel(Artist.name) private readonly artistModel: Model<ArtistDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // VENUE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Venue creates a gig
   */
  async createGig(venueUserId: string, dto: CreateGigDto): Promise<GigDocument> {
    const venue = await this.findVenueByUserId(venueUserId, dto.venueId);

    if (!venue) {
      throw new ForbiddenException(
        'You are not allowed to create gigs for this venue.',
      );
    }

    if (!dto.location?.geoCoordinates || dto.location.geoCoordinates.length !== 2) {
      throw new BadRequestException(
        'Gig location geoCoordinates must be [longitude, latitude].',
      );
    }

    const [lng, lat] = dto.location.geoCoordinates;

    if (!this.isValidLongitude(lng) || !this.isValidLatitude(lat)) {
      throw new BadRequestException(
        'Invalid geoCoordinates. Expected [longitude (-180..180), latitude (-90..90)].',
      );
    }

    const status = dto.status ?? 'draft';
    if (status === 'open') {
      if (!venue.hasCompletedSetup || !venue.isProfileVisible) {
        throw new ForbiddenException(
          'Complete venue setup before publishing gigs.',
        );
      }
      if (!venue.isOpenForBookings) {
        throw new ForbiddenException(
          'Enable accepting bookings before publishing gigs.',
        );
      }
    }

    const gig = new this.gigModel({
      venue: venue._id,
      postedBy: new Types.ObjectId(venueUserId),

      title: dto.title,
      description: dto.description,

      date: new Date(dto.date),
      startTime: dto.startTime,
      endTime: dto.endTime,
      durationMinutes: dto.durationMinutes ?? 60,
      numberOfSets: dto.numberOfSets ?? 1,

      requiredGenres: dto.requiredGenres ?? [],
      specificRequirements: dto.specificRequirements,
      artistsNeeded: dto.artistsNeeded ?? 1,

      budget: dto.budget,
      currency: dto.currency ?? 'USD',
      paymentType: dto.paymentType ?? 'fixed',

      status,

      location: {
        venueAddress: dto.location.venueAddress,
        city: dto.location.city,
        state: dto.location.state,
        postalCode: dto.location.postalCode,
        country: dto.location.country,
        geo: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      },

      isPublic: dto.isPublic ?? true,
      acceptingApplications: dto.acceptingApplications ?? true,

      perks: {
        providesFood: dto.perks?.providesFood ?? false,
        providesDrinks: dto.perks?.providesDrinks ?? false,
        providesAccommodation: dto.perks?.providesAccommodation ?? false,
        providesTransport: dto.perks?.providesTransport ?? false,
        additionalPerks: dto.perks?.additionalPerks ?? [],
      },

      viewCount: 0,
      applicationCount: 0,
      applications: [],
      bookedArtists: [],
    });

    await gig.save();
    return gig;
  }

  /**
   * Venue updates a gig they own
   */
  async updateGig(
    venueUserId: string,
    gigId: string,
    dto: UpdateGigDto,
  ): Promise<GigDocument> {
    const gig = await this.gigModel.findById(gigId).exec();

    if (!gig) {
      throw new NotFoundException('Gig not found');
    }

    if (gig.postedBy.toString() !== venueUserId) {
      throw new ForbiddenException('You can only update your own gigs.');
    }

    const update: Record<string, any> = {};

    if (dto.title !== undefined) update.title = dto.title;
    if (dto.description !== undefined) update.description = dto.description;
    if (dto.date !== undefined) update.date = new Date(dto.date);
    if (dto.startTime !== undefined) update.startTime = dto.startTime;
    if (dto.endTime !== undefined) update.endTime = dto.endTime;
    if (dto.durationMinutes !== undefined) update.durationMinutes = dto.durationMinutes;
    if (dto.numberOfSets !== undefined) update.numberOfSets = dto.numberOfSets;
    if (dto.requiredGenres !== undefined) update.requiredGenres = dto.requiredGenres;
    if (dto.specificRequirements !== undefined) {
      update.specificRequirements = dto.specificRequirements;
    }
    if (dto.artistsNeeded !== undefined) update.artistsNeeded = dto.artistsNeeded;
    if (dto.budget !== undefined) update.budget = dto.budget;
    if (dto.currency !== undefined) update.currency = dto.currency;
    if (dto.paymentType !== undefined) update.paymentType = dto.paymentType;
    if (dto.isPublic !== undefined) update.isPublic = dto.isPublic;
    if (dto.acceptingApplications !== undefined) {
      update.acceptingApplications = dto.acceptingApplications;
    }
    if (dto.perks !== undefined) update.perks = dto.perks;
    if (dto.status !== undefined) update.status = dto.status;

    if (dto.location) {
      if (
        !dto.location.geoCoordinates ||
        dto.location.geoCoordinates.length !== 2
      ) {
        throw new BadRequestException(
          'Gig location geoCoordinates must be [longitude, latitude].',
        );
      }
      const [lng, lat] = dto.location.geoCoordinates;
      if (!this.isValidLongitude(lng) || !this.isValidLatitude(lat)) {
        throw new BadRequestException('Invalid geoCoordinates.');
      }
      update.location = {
        venueAddress: dto.location.venueAddress,
        city: dto.location.city,
        state: dto.location.state,
        postalCode: dto.location.postalCode,
        country: dto.location.country,
        geo: { type: 'Point', coordinates: [lng, lat] },
      };
    }

    const updated = await this.gigModel
      .findByIdAndUpdate(gigId, { $set: update }, { new: true })
      .populate('venue', 'venueName venueType coverPhoto location')
      .exec();

    if (!updated) {
      throw new NotFoundException('Gig not found');
    }

    return updated;
  }

  /**
   * Venue lists their gigs
   */
  async getVenueGigs(
    venueUserId: string,
    opts?: { page?: number; limit?: number; status?: string },
  ): Promise<PaginatedResult<GigDocument>> {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts?.limit ?? 20));
    const skip = (page - 1) * limit;

    const venue = await this.findVenueByUserId(venueUserId);

    if (!venue) {
      throw new NotFoundException('Venue profile not found');
    }

    const filter: Record<string, any> = { venue: venue._id };
    if (opts?.status) {
      filter.status = opts.status;
    }

    const [items, total] = await Promise.all([
      this.gigModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('venue', 'venueName venueType coverPhoto location')
        .exec(),
      this.gigModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SHARED OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get a gig by ID (any authenticated user)
   */
  async getGigById(gigId: string): Promise<GigDocument> {
    if (!Types.ObjectId.isValid(gigId)) {
      throw new BadRequestException('Invalid gig ID');
    }

    const gig = await this.gigModel
      .findById(gigId)
      .populate('venue', 'venueName venueType coverPhoto location')
      .exec();

    if (!gig) {
      throw new NotFoundException('Gig not found');
    }

    return gig;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ARTIST OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Artist applies to a gig
   */
  async applyToGig(
    artistUserId: string,
    gigId: string,
    dto: ApplyToGigDto,
  ): Promise<GigDocument> {
    const artist = await this.artistModel
      .findOne({ userId: new Types.ObjectId(artistUserId) })
      .exec();

    if (!artist) {
      throw new NotFoundException('Artist profile not found');
    }

    const gig = await this.gigModel.findById(gigId).exec();

    if (!gig) {
      throw new NotFoundException('Gig not found');
    }

    if (gig.status !== 'open') {
      throw new BadRequestException('This gig is not accepting applications.');
    }

    if (!gig.acceptingApplications) {
      throw new BadRequestException('This gig is not accepting applications.');
    }

    const alreadyApplied = gig.applications.some(
      (app) => app.artist.toString() === artist._id.toString(),
    );

    if (alreadyApplied) {
      throw new ConflictException('You have already applied to this gig.');
    }

    gig.applications.push({
      artist: artist._id as Types.ObjectId,
      appliedAt: new Date(),
      message: dto.message,
      proposedRate: dto.proposedRate,
      status: 'pending',
    });
    gig.applicationCount = gig.applications.length;

    await gig.save();

    return this.gigModel
      .findById(gigId)
      .populate('venue', 'venueName venueType coverPhoto location')
      .exec() as Promise<GigDocument>;
  }

  /**
   * Artist accepts a gig offer (application was already accepted by venue)
   */
  async acceptGig(artistUserId: string, gigId: string): Promise<GigDocument> {
    const artist = await this.artistModel
      .findOne({ userId: new Types.ObjectId(artistUserId) })
      .exec();

    if (!artist) {
      throw new NotFoundException('Artist profile not found');
    }

    const gig = await this.gigModel.findById(gigId).exec();

    if (!gig) {
      throw new NotFoundException('Gig not found');
    }

    const application = gig.applications.find(
      (app) =>
        app.artist.toString() === artist._id.toString() &&
        app.status === 'accepted',
    );

    if (!application) {
      throw new BadRequestException(
        'No accepted application found for this gig.',
      );
    }

    const alreadyBooked = gig.bookedArtists.some(
      (id) => id.toString() === artist._id.toString(),
    );

    if (!alreadyBooked) {
      gig.bookedArtists.push(artist._id as Types.ObjectId);
    }

    if (gig.bookedArtists.length >= gig.artistsNeeded) {
      gig.status = 'filled';
      gig.acceptingApplications = false;
    }

    await gig.save();

    return this.gigModel
      .findById(gigId)
      .populate('venue', 'venueName venueType coverPhoto location')
      .exec() as Promise<GigDocument>;
  }

  /**
   * Artist declines a gig offer
   */
  async declineGig(
    artistUserId: string,
    gigId: string,
    reason?: string,
  ): Promise<void> {
    const artist = await this.artistModel
      .findOne({ userId: new Types.ObjectId(artistUserId) })
      .exec();

    if (!artist) {
      throw new NotFoundException('Artist profile not found');
    }

    const gig = await this.gigModel.findById(gigId).exec();

    if (!gig) {
      throw new NotFoundException('Gig not found');
    }

    const application = gig.applications.find(
      (app) => app.artist.toString() === artist._id.toString(),
    );

    if (!application) {
      throw new BadRequestException('No application found for this gig.');
    }

    application.status = 'withdrawn';
    await gig.save();
  }

  /**
   * Artist discovery feed for gigs (geo + genres + budget)
   *
   * - Defaults come from artist profile when query params are missing
   * - Uses exact geo radius with 2dsphere index on gig.location.geo
   * - Filters out non-open / non-public gigs
   */
  async discoverGigsForArtist(
    artistUserId: string,
    query: DiscoverGigsDto,
  ): Promise<PaginatedResult<GigDocument>> {
    const artist = await this.artistModel
      .findOne({ userId: new Types.ObjectId(artistUserId) })
      .exec();

    if (!artist) {
      throw new NotFoundException('Artist profile not found');
    }

    const fallbackGenres =
      artist.genres && artist.genres.length > 0 ? artist.genres : [];

    const fallbackRadiusKm =
      artist.location?.travelRadiusMiles && artist.location.travelRadiusMiles > 0
        ? artist.location.travelRadiusMiles
        : 25;

    const artistCoords = artist.location?.coordinates;
    const hasArtistCoords =
      Array.isArray(artistCoords) &&
      artistCoords.length === 2 &&
      typeof artistCoords[0] === 'number' &&
      typeof artistCoords[1] === 'number';

    const latitude =
      query.latitude ??
      (hasArtistCoords ? (artistCoords![1] as number) : undefined);

    const longitude =
      query.longitude ??
      (hasArtistCoords ? (artistCoords![0] as number) : undefined);

    const radiusKm = query.radiusKm ?? fallbackRadiusKm;
    const genres = query.genres?.length ? query.genres : fallbackGenres;

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    // Base filter for discoverable gigs
    const filter: Record<string, any> = {
      status: 'open',
      isPublic: true,
      acceptingApplications: true,
      'location.geo': { $exists: true },
    };

    // Separate count filter (countDocuments does not support $near)
    const countFilter: Record<string, any> = { ...filter };

    if (query.minBudget !== undefined) {
      filter.budget = { ...(filter.budget ?? {}), $gte: query.minBudget };
      countFilter.budget = { ...(countFilter.budget ?? {}), $gte: query.minBudget };
    }
    if (query.maxBudget !== undefined) {
      filter.budget = { ...(filter.budget ?? {}), $lte: query.maxBudget };
      countFilter.budget = { ...(countFilter.budget ?? {}), $lte: query.maxBudget };
    }

    if (genres.length) {
      filter.requiredGenres = { $in: genres };
      countFilter.requiredGenres = { $in: genres };
    }

    let isGeoQuery = false;

    if (
      latitude !== undefined &&
      longitude !== undefined &&
      this.isValidLatitude(latitude) &&
      this.isValidLongitude(longitude)
    ) {
      // $near for find() - sorted by distance
      filter['location.geo'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: radiusKm * 1000,
        },
      };
      // $geoWithin for countDocuments - compatible with count operations
      countFilter['location.geo'] = {
        $geoWithin: {
          $centerSphere: [
            [longitude, latitude],
            radiusKm / 6378.1, // Convert km to radians
          ],
        },
      };
      isGeoQuery = true;
    }

    const sortBy = query.sortBy ?? 'relevance';

    const nonGeoSort: Record<string, any> =
      sortBy === 'date'
        ? { date: 1 }
        : sortBy === 'budget'
          ? { budget: -1 }
          : sortBy === 'newest'
            ? { createdAt: -1 }
            : { createdAt: -1 };

    const findQuery = this.gigModel.find(filter);

    if (!isGeoQuery) {
      findQuery.sort(nonGeoSort);
    }

    findQuery.populate('venue', 'venueName venueType coverPhoto location');

    const [items, total] = await Promise.all([
      findQuery.skip(skip).limit(limit).exec(),
      this.gigModel.countDocuments(countFilter).exec(),
    ]);

    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Find venue by user ID, optionally requiring a specific venue _id match.
   * Handles both string and ObjectId userId for backward compatibility.
   */
  private async findVenueByUserId(
    venueUserId: string,
    venueId?: string,
  ): Promise<VenueDocument | null> {
    const venueUserIdObj = new Types.ObjectId(venueUserId);
    const filter: Record<string, any> = {
      $or: [{ userId: venueUserIdObj }, { userId: venueUserId }],
    };
    if (venueId) {
      filter._id = venueId;
    }
    return this.venueModel.findOne(filter).exec();
  }

  private isValidLatitude(lat: number): boolean {
    return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90;
  }

  private isValidLongitude(lng: number): boolean {
    return (
      typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180
    );
  }
}
