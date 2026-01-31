import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Gig, GigDocument } from '../schemas/gig.schema';
import { Venue, VenueDocument } from '../venues/schemas/venue.schema';
import { Artist, ArtistDocument } from '../artists/schemas/artist.schema';
import { User, UserDocument } from '../schemas/user.schema';

import { CreateGigDto, DiscoverGigsDto } from './dto/gig.dto';

type DiscoverResult<T> = {
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

  /**
   * ✅ Venue creates a gig
   * - Requires caller to be a venue user
   * - Requires venue profile exists and matches dto.venueId
   * - Copies + stores exact location (GeoJSON Point) for geo discovery ($near)
   */
  async createGig(venueUserId: string, dto: CreateGigDto): Promise<GigDocument> {
    // Debug: Log what we're searching for
    console.log('🔍 createGig - Searching for venue:', {
      venueId: dto.venueId,
      userId: venueUserId,
    });

    // Validate venue user + venue profile ownership
    // Note: userId may be stored as string or ObjectId depending on when venue was created
    // Use $or to handle both cases for backward compatibility
    const venueUserIdObj = new Types.ObjectId(venueUserId);
    const venue = await this.venueModel
      .findOne({
        _id: dto.venueId,
        $or: [
          { userId: venueUserIdObj },
          { userId: venueUserId },
        ],
      })
      .exec();

    // Debug: Log if venue was found
    if (venue) {
      console.log('✅ Venue found:', { _id: venue._id, userId: venue.userId });
    } else {
      // Try to find the venue without userId constraint to debug
      const venueById = await this.venueModel.findById(dto.venueId).exec();
      console.log('❌ Venue NOT found with userId match. Venue by ID only:', venueById ? {
        _id: venueById._id,
        userId: venueById.userId,
        expectedUserId: venueUserId,
      } : 'NOT FOUND');
    }

    if (!venue) {
      throw new ForbiddenException(
        'You are not allowed to create gigs for this venue.',
      );
    }

    // Basic validation: must have coordinates
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

    // Enforce: venue must have completed setup to publish open gigs
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

      // Location
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

      // Stats
      viewCount: 0,
      applicationCount: 0,

      // Defaults
      applications: [],
      bookedArtists: [],
    });

    await gig.save();
    return gig;
  }

  /**
   * ✅ Venue list their gigs
   */
  async getVenueGigs(
    venueUserId: string,
    opts?: { page?: number; limit?: number; status?: string },
  ): Promise<DiscoverResult<GigDocument>> {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts?.limit ?? 20));
    const skip = (page - 1) * limit;

    // Handle both string and ObjectId userId for backward compatibility
    const venueUserIdObj = new Types.ObjectId(venueUserId);
    const venue = await this.venueModel
      .findOne({
        $or: [
          { userId: venueUserIdObj },
          { userId: venueUserId },
        ],
      })
      .exec();

    if (!venue) {
      throw new NotFoundException('Venue profile not found');
    }

    const filter: Record<string, any> = { venue: venue._id };
    if (opts?.status) filter.status = opts.status;

    const [items, total] = await Promise.all([
      this.gigModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.gigModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * ✅ Artist discovery feed for gigs (geo + genres + budget)
   *
   * Enterprise UX rules:
   * - Defaults come from artist profile when query params are missing
   * - Uses exact geo radius with 2dsphere index on gig.location.geo
   * - Filters out non-open / non-public gigs
   */
  async discoverGigsForArtist(
    artistUserId: string,
    query: DiscoverGigsDto,
  ): Promise<DiscoverResult<GigDocument>> {
    const artist = await this.artistModel
      .findOne({ userId: new Types.ObjectId(artistUserId) })
      .exec();

    if (!artist) {
      throw new NotFoundException('Artist profile not found');
    }

    // Determine defaults from artist profile
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

    // Base filter: only gigs that can be acted upon
    const filter: Record<string, any> = {
      status: 'open',
      isPublic: true,
      acceptingApplications: true,
      // Must have location for geo discovery
      'location.geo': { $exists: true },
    };

    // Budget filters
    if (query.minBudget !== undefined) {
      filter.budget = { ...(filter.budget ?? {}), $gte: query.minBudget };
    }
    if (query.maxBudget !== undefined) {
      filter.budget = { ...(filter.budget ?? {}), $lte: query.maxBudget };
    }

    // Genre filter (optional; if artist has no genres, we don't block discovery)
    if (genres.length) {
      filter.requiredGenres = { $in: genres };
    }

    // Geo filter (recommended default)
    if (
      latitude !== undefined &&
      longitude !== undefined &&
      this.isValidLatitude(latitude) &&
      this.isValidLongitude(longitude)
    ) {
      filter['location.geo'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: radiusKm * 1000,
        },
      };
    } else {
      // If artist lacks coordinates, discovery still works (but less relevant).
      // We intentionally do NOT throw; we keep UX smooth.
      // Optionally, you can later enforce setup completion by requiring coords.
    }

    // Sorting
    // Note: With $near, Mongo will already order by distance.
    // If no $near, we use sortBy selection.
    const sortBy = query.sortBy ?? 'relevance';

    const nonGeoSort: Record<string, any> =
      sortBy === 'date'
        ? { date: 1 }
        : sortBy === 'budget'
          ? { budget: -1 }
          : sortBy === 'newest'
            ? { createdAt: -1 }
            : { createdAt: -1 }; // relevance fallback

    const isGeoQuery = !!filter['location.geo']?.$near;

    const findQuery = this.gigModel.find(filter);

    if (!isGeoQuery) {
      findQuery.sort(nonGeoSort);
    }

    // NOTE: Keeping population light for mobile performance.
    // If you need venue fields, either populate selectively or denormalize.
    findQuery.populate('venue', 'venueName venueType coverPhoto location city country');

    const [items, total] = await Promise.all([
      findQuery.skip(skip).limit(limit).exec(),
      this.gigModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  private isValidLatitude(lat: number): boolean {
    return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90;
  }

  private isValidLongitude(lng: number): boolean {
    return typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
  }
}
