import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';

import { Gig, GigDocument } from '../schemas/gig.schema';
import { Venue, VenueDocument } from '../venues/schemas/venue.schema';
import { Artist, ArtistDocument } from '../artists/schemas/artist.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Booking, BookingDocument } from '../schemas/booking.schema';
import { NotificationsService } from '../notifications/notifications.service';

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
  private readonly logger = new Logger(GigsService.name);

  constructor(
    @InjectModel(Gig.name) private readonly gigModel: Model<GigDocument>,
    @InjectModel(Venue.name) private readonly venueModel: Model<VenueDocument>,
    @InjectModel(Artist.name)
    private readonly artistModel: Model<ArtistDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // VENUE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Venue creates a gig
   */
  async createGig(
    venueUserId: string,
    dto: CreateGigDto,
  ): Promise<GigDocument> {
    const venue = await this.findVenueByUserId(venueUserId, dto.venueId);

    if (!venue) {
      throw new ForbiddenException(
        'You are not allowed to create gigs for this venue.',
      );
    }

    if (
      !dto.location?.geoCoordinates ||
      dto.location.geoCoordinates.length !== 2
    ) {
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
      gigType: dto.gigType ?? 'live_performance',

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
        providesEquipment: dto.perks?.providesEquipment ?? false,
        providesParking: dto.perks?.providesParking ?? false,
        additionalPerks: dto.perks?.additionalPerks ?? [],
      },

      viewCount: 0,
      applicationCount: 0,
      applications: [],
      bookedArtists: [],
    });

    await gig.save();

    // Notify matching artists if gig is published (status = 'open')
    if (gig.status === 'open' && gig.isPublic) {
      const [lng, lat] = gig.location.geo.coordinates;
      this.notificationsService.notifyArtistsOfNewGig(
        gig._id.toString(),
        gig.title,
        gig.requiredGenres,
        { lat, lng },
        gig.budget,
        venue.venueName,
      ).catch((err) => {
        this.logger.warn(`Failed to notify artists of new gig: ${err.message}`);
      });
    }

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
    if (dto.durationMinutes !== undefined)
      update.durationMinutes = dto.durationMinutes;
    if (dto.numberOfSets !== undefined) update.numberOfSets = dto.numberOfSets;
    if (dto.requiredGenres !== undefined)
      update.requiredGenres = dto.requiredGenres;
    if (dto.specificRequirements !== undefined) {
      update.specificRequirements = dto.specificRequirements;
    }
    if (dto.artistsNeeded !== undefined)
      update.artistsNeeded = dto.artistsNeeded;
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

    // If gig was just published (status changed to 'open'), notify matching artists
    if (
      dto.status === 'open' &&
      gig.status !== 'open' &&
      updated.isPublic
    ) {
      const venue = await this.venueModel.findById(updated.venue).exec();
      if (venue) {
        const [lng, lat] = updated.location.geo.coordinates;
        this.notificationsService.notifyArtistsOfNewGig(
          updated._id.toString(),
          updated.title,
          updated.requiredGenres,
          { lat, lng },
          updated.budget,
          venue.venueName,
        ).catch((err) => {
          this.logger.warn(`Failed to notify artists of published gig: ${err.message}`);
        });
      }
    }

    return updated;
  }

  /**
   * Delete a gig (venue only)
   */
  async deleteGig(venueUserId: string, gigId: string): Promise<void> {
    const gig = await this.gigModel.findById(gigId).exec();

    if (!gig) {
      throw new NotFoundException('Gig not found');
    }

    if (gig.postedBy.toString() !== venueUserId) {
      throw new ForbiddenException('You can only delete your own gigs.');
    }

    await this.gigModel.findByIdAndDelete(gigId);
  }

  /**
   * Cancel a gig (soft delete - updates status to cancelled)
   */
  async cancelGig(
    venueUserId: string,
    gigId: string,
    reason?: string,
  ): Promise<GigDocument> {
    const gig = await this.gigModel.findById(gigId).exec();

    if (!gig) {
      throw new NotFoundException('Gig not found');
    }

    if (gig.postedBy.toString() !== venueUserId) {
      throw new ForbiddenException('You can only cancel your own gigs.');
    }

    const updated = await this.gigModel
      .findByIdAndUpdate(
        gigId,
        {
          $set: {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancellationReason: reason,
          },
        },
        { new: true },
      )
      .populate('venue', 'venueName venueType coverPhoto location')
      .exec();

    return updated!;
  }

  /**
   * Venue lists their gigs
   */
  async getVenueGigs(
    venueUserId: string,
    opts?: { page?: number; limit?: number; status?: string },
  ): Promise<PaginatedResult<GigDocument>> {
    try {
      const page = Math.max(1, opts?.page ?? 1);
      const limit = Math.min(50, Math.max(1, opts?.limit ?? 20));
      const skip = (page - 1) * limit;

      console.log('🎯 [GigsService] Getting venue gigs for user:', venueUserId);

      const venue = await this.findVenueByUserId(venueUserId);

      if (!venue) {
        console.log('❌ [GigsService] Venue profile not found for user:', venueUserId);
        throw new NotFoundException('Venue profile not found');
      }

      console.log('✅ [GigsService] Found venue:', venue._id.toString());

      const filter: Record<string, any> = { venue: venue._id };
      if (opts?.status) {
        filter.status = opts.status;
      }

      console.log('🔍 [GigsService] Query filter:', JSON.stringify(filter));

      console.log('🔍 [GigsService] Executing query...');
      const [items, total] = await Promise.all([
        this.gigModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate({
            path: 'venue',
            select: 'venueName venueType location',
          })
          .lean()
          .exec(),
        this.gigModel.countDocuments(filter).exec(),
      ]);

      console.log('✅ [GigsService] Query completed - Found gigs:', items.length, 'Total:', total);

      return { items, total, page, pages: Math.ceil(total / limit) };
    } catch (err) {
      console.error('❌ [GigsService] getVenueGigs error:', err);
      throw err;
    }
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
   * Enforces tier-based application limits:
   * - Free: 5 applications/month
   * - Pro: 20 applications/month
   * - Premium: Unlimited
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

    // Get user's subscription tier and check limits
    const user = await this.userModel.findById(
      new Types.ObjectId(artistUserId),
    );
    const tier = user?.subscriptionTier || 'free';

    // Count applications this month
    const applicationsThisMonth =
      await this.countApplicationsThisMonth(artistUserId);

    // Apply limits based on tier
    let maxApps = 5; // Free tier
    if (tier === 'pro') {
      maxApps = 20;
    }
    if (tier === 'premium') {
      maxApps = -1;
    } // Unlimited

    if (maxApps !== -1 && applicationsThisMonth >= maxApps) {
      throw new BadRequestException(
        `You have reached your monthly limit of ${maxApps} gig applications. Upgrade your subscription for more applications.`,
      );
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

    // Notify venue about the new application
    this.notificationsService.notifyVenueOfApplication(
      gig.postedBy.toString(),
      gigId,
      gig.title,
      artist.stageName || artist.displayName || 'An artist',
      dto.proposedRate,
    ).catch((err) => {
      this.logger.warn(`Failed to notify venue of application: ${err.message}`);
    });

    return this.gigModel
      .findById(gigId)
      .populate('venue', 'venueName venueType coverPhoto location')
      .exec() as Promise<GigDocument>;
  }

  /**
   * Count how many gig applications artist has made this month
   */
  async countApplicationsThisMonth(artistUserId: string): Promise<number> {
    const artist = await this.artistModel.findOne({
      userId: new Types.ObjectId(artistUserId),
    });
    if (!artist) {
      return 0;
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const count = await this.gigModel.countDocuments({
      'applications.artist': artist._id,
      'applications.appliedAt': { $gte: startOfMonth },
    });

    return count;
  }

  /**
   * Artist confirms they accept the gig offer (application was already accepted by venue).
   * This confirms the existing booking created by acceptApplicationAndCreateBooking.
   * Returns the booking that was confirmed.
   */
  async confirmGigBooking(
    artistUserId: string,
    gigId: string,
  ): Promise<BookingDocument> {
    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      const artist = await this.artistModel
        .findOne({ userId: new Types.ObjectId(artistUserId) })
        .session(session)
        .exec();

      if (!artist) {
        throw new NotFoundException('Artist profile not found');
      }

      const gig = await this.gigModel
        .findById(gigId)
        .session(session)
        .exec();

      if (!gig) {
        throw new NotFoundException('Gig not found');
      }

      // Check artist has an accepted application
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

      // Find the pending booking for this gig and artist
      const booking = await this.bookingModel
        .findOne({
          gig: new Types.ObjectId(gigId),
          artist: artist._id,
          status: 'pending',
        })
        .session(session)
        .exec();

      if (!booking) {
        throw new NotFoundException(
          'No pending booking found for this gig. The venue may need to accept your application first.',
        );
      }

      // Artist confirms their side of the booking
      booking.artistConfirmed = true;
      booking.artistConfirmedAt = new Date();

      // Both confirmed = booking confirmed
      if (booking.venueConfirmed && booking.artistConfirmed) {
        booking.status = 'confirmed';
      }

      await booking.save({ session });

      await session.commitTransaction();

      // Notify venue of confirmation (outside transaction)
      await this.notificationsService.sendNotification({
        userId: booking.venueUser.toString(),
        type: 'booking_confirmation',
        title: 'Artist Confirmed!',
        body: `${artist.stageName ?? 'The artist'} has confirmed the booking for "${gig.title}"`,
        deepLink: `/booking/${booking._id.toString()}`,
      });

      return booking;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * @deprecated Use confirmGigBooking instead. This method is kept for backward compatibility.
   */
  async acceptGig(artistUserId: string, gigId: string): Promise<GigDocument> {
    // Call the new method and return the gig for backward compatibility
    await this.confirmGigBooking(artistUserId, gigId);

    return this.gigModel
      .findById(gigId)
      .populate('venue', 'venueName venueType coverPhoto location')
      .exec() as Promise<GigDocument>;
  }

  /**
   * Artist declines a gig offer (application was already accepted by venue)
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

    // Use 'rejected' status when artist declines a booking offer
    application.status = 'rejected';
    await gig.save();

    // Notify venue that artist declined the offer
    await this.notificationsService.sendNotification({
      userId: gig.postedBy.toString(),
      type: 'booking_declined',
      title: 'Artist Declined Booking',
      body: `${artist.stageName ?? 'The artist'} has declined the booking for "${gig.title}".${reason ? ` Reason: ${reason}` : ''}`,
      deepLink: `/gigs/${gigId}`,
    });
  }

  /**
   * Artist withdraws a pending application before venue decision
   */
  async withdrawApplication(
    artistUserId: string,
    gigId: string,
    reason?: string,
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

    const application = gig.applications.find(
      (app) => app.artist.toString() === artist._id.toString(),
    );

    if (!application) {
      throw new BadRequestException('No application found for this gig.');
    }

    if (application.status !== 'pending') {
      throw new BadRequestException(
        `Cannot withdraw application with status '${application.status}'. Only pending applications can be withdrawn.`,
      );
    }

    application.status = 'withdrawn';
    gig.applicationCount = Math.max(0, (gig.applicationCount || 1) - 1);
    await gig.save();

    this.logger.log(
      `Artist ${artist._id.toString()} withdrew application from gig ${gigId}${reason ? `: ${reason}` : ''}`,
    );

    return this.gigModel
      .findById(gigId)
      .populate('venue', 'venueName venueType coverPhoto location')
      .exec() as Promise<GigDocument>;
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
      artist.location?.travelRadiusMiles &&
      artist.location.travelRadiusMiles > 0
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
      countFilter.budget = {
        ...(countFilter.budget ?? {}),
        $gte: query.minBudget,
      };
    }
    if (query.maxBudget !== undefined) {
      filter.budget = { ...(filter.budget ?? {}), $lte: query.maxBudget };
      countFilter.budget = {
        ...(countFilter.budget ?? {}),
        $lte: query.maxBudget,
      };
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
  // APPLICATION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get all applications for a gig (venue only)
   */
  async getGigApplications(venueUserId: string, gigId: string): Promise<any[]> {
    const gig = await this.gigModel.findById(gigId).exec();

    if (!gig) {
      throw new NotFoundException('Gig not found');
    }

    if (gig.postedBy.toString() !== venueUserId) {
      throw new ForbiddenException(
        'You can only view applications for your own gigs.',
      );
    }

    // Populate artist details
    const populatedGig = await this.gigModel
      .findById(gigId)
      .populate({
        path: 'applications.artist',
        select: 'stageName profilePhoto genres averageRating userId',
      })
      .exec();

    return populatedGig?.applications || [];
  }

  /**
   * Get count of pending applications
   */
  async getApplicationCount(gigId: string): Promise<number> {
    const gig = await this.gigModel.findById(gigId).exec();
    if (!gig) return 0;

    const applications = gig.applications || [];
    return applications.filter((a: any) => a.status === 'pending').length;
  }

  /**
   * Get all applications made by an artist (with pagination)
   */
  async getArtistApplications(
    artistUserId: string,
    status?: 'pending' | 'accepted' | 'rejected',
    page: number = 1,
    limit: number = 20,
  ): Promise<{ applications: any[]; total: number; page: number; pages: number }> {
    const artist = await this.artistModel
      .findOne({ userId: new Types.ObjectId(artistUserId) })
      .exec();

    if (!artist) {
      throw new NotFoundException('Artist profile not found');
    }

    const query: any = { 'applications.artist': artist._id };

    const [gigs, total] = await Promise.all([
      this.gigModel
        .find(query)
        .populate('venue', 'venueName venueType coverPhoto location')
        .sort({ 'applications.appliedAt': -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.gigModel.countDocuments(query).exec(),
    ]);

    // Flatten and map applications
    const applications = gigs.flatMap((gig: any) => {
      const myApps = (gig.applications || []).filter(
        (a: any) => a.artist.toString() === artist._id.toString(),
      );
      return myApps
        .filter((a: any) => !status || a.status === status)
        .map((a: any) => ({
          gigId: gig._id,
          gigTitle: gig.title,
          gigDate: gig.date,
          gigStatus: gig.status,
          application: {
            _id: a._id,
            appliedAt: a.appliedAt,
            message: a.message,
            proposedRate: a.proposedRate,
            status: a.status,
          },
          venue: gig.venue,
        }));
    });

    return {
      applications,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Accept an application and auto-create a booking (with transaction)
   */
  async acceptApplicationAndCreateBooking(
    venueUserId: string,
    gigId: string,
    artistId: string,
    agreedAmount: number,
    startTime: string,
    endTime?: string,
    specialRequests?: string,
  ): Promise<any> {
    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      // Step 1: Validate gig exists and belongs to venue
      const gig = await this.gigModel.findById(gigId).session(session).exec();
      if (!gig) {
        throw new NotFoundException('Gig not found');
      }
      if (gig.postedBy.toString() !== venueUserId) {
        throw new ForbiddenException(
          'You can only accept applications for your own gigs.',
        );
      }

      // Step 2: Find and update the application
      const applicationIndex = gig.applications?.findIndex(
        (a: any) => a.artist.toString() === artistId && a.status === 'pending',
      );

      if (applicationIndex === undefined || applicationIndex === -1) {
        throw new BadRequestException(
          'No pending application found for this artist.',
        );
      }

      // Step 3: Update application status
      gig.applications[applicationIndex].status = 'accepted';

      // Step 4: Add to booked artists
      if (!gig.bookedArtists) {
        gig.bookedArtists = [];
      }
      const alreadyBooked = gig.bookedArtists.some(
        (id) => id.toString() === artistId,
      );
      if (!alreadyBooked) {
        gig.bookedArtists.push(new Types.ObjectId(artistId));
      }

      // Step 5: Update gig status if all positions filled
      if (gig.bookedArtists.length >= gig.artistsNeeded) {
        gig.status = 'filled';
        gig.acceptingApplications = false;
      }

      await gig.save({ session });

      // Step 6: Get artist and venue details for booking
      const artist = await this.artistModel
        .findById(artistId)
        .session(session)
        .exec();
      const venue = await this.venueModel
        .findById(gig.venue)
        .session(session)
        .exec();

      if (!artist || !venue) {
        throw new NotFoundException('Artist or venue not found');
      }

      // Step 7: Create the booking
      const booking = new this.bookingModel({
        artist: new Types.ObjectId(artistId),
        venue: gig.venue,
        artistUser: artist.userId,
        venueUser: new Types.ObjectId(venueUserId),
        gig: new Types.ObjectId(gigId),
        title: gig.title,
        description: gig.description,
        date: gig.date,
        startTime: startTime,
        endTime: endTime || gig.endTime,
        durationMinutes: gig.durationMinutes || 60,
        numberOfSets: gig.numberOfSets || 1,
        agreedAmount: agreedAmount,
        currency: gig.currency || 'USD',
        payment: {
          depositAmount: agreedAmount * 0.25, // 25% deposit
          depositPaid: false,
          finalPaid: false,
        },
        specialRequests: specialRequests,
        status: 'pending',
        artistConfirmed: false,
        venueConfirmed: true, // Venue confirms by accepting
        venueConfirmedAt: new Date(),
      });

      await booking.save({ session });

      // Commit the transaction
      await session.commitTransaction();

      this.logger.log(
        `Application accepted and booking ${booking._id.toString()} created for gig ${gigId}`,
      );

      // Step 8: Send notification to artist (outside transaction)
      await this.notificationsService.sendNotification({
        userId: artist.userId.toString(),
        type: 'gig_confirmation',
        title: 'Application Accepted!',
        body: `Your application to "${gig.title}" at ${venue.venueName} was accepted!`,
        deepLink: `/booking/${booking._id.toString()}`,
      });

      return {
        message: 'Application accepted and booking created',
        gig: await this.getGigById(gigId),
        booking: booking,
      };
    } catch (error) {
      await session.abortTransaction();
      this.logger.error(
        `Failed to accept application for gig ${gigId}: ${String(error)}`,
      );
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Venue declines an application
   */
  async declineApplicationByVenue(
    venueUserId: string,
    gigId: string,
    artistId: string,
    reason?: string,
  ): Promise<GigDocument> {
    const gig = await this.gigModel.findById(gigId).exec();

    if (!gig) {
      throw new NotFoundException('Gig not found');
    }

    if (gig.postedBy.toString() !== venueUserId) {
      throw new ForbiddenException(
        'You can only decline applications for your own gigs.',
      );
    }

    const application = gig.applications.find(
      (app) => app.artist.toString() === artistId,
    );

    if (!application) {
      throw new BadRequestException('No application found for this artist.');
    }

    application.status = 'rejected';
    // Decrement applicationCount to reflect accurate pending count
    gig.applicationCount = Math.max(0, (gig.applicationCount || 1) - 1);
    await gig.save();

    // Notify artist
    const artist = await this.artistModel.findById(artistId).exec();
    if (artist) {
      await this.notificationsService.sendNotification({
        userId: artist.userId.toString(),
        type: 'gig_cancelled',
        title: 'Application Update',
        body: `Your application to "${gig.title}" was not accepted.${reason ? ` Reason: ${reason}` : ''}`,
        deepLink: `/gigs/${gigId}`,
      });
    }

    return this.gigModel
      .findById(gigId)
      .populate('venue', 'venueName venueType coverPhoto location')
      .exec() as Promise<GigDocument>;
  }

  /**
   * Increment view count for a gig (called when user views gig details)
   */
  async incrementViewCount(gigId: string): Promise<{ viewCount: number }> {
    if (!Types.ObjectId.isValid(gigId)) {
      throw new BadRequestException('Invalid gig ID');
    }

    const result = await this.gigModel
      .findByIdAndUpdate(
        gigId,
        { $inc: { viewCount: 1 } },
        { new: true, select: 'viewCount' },
      )
      .exec();

    if (!result) {
      throw new NotFoundException('Gig not found');
    }

    return { viewCount: result.viewCount };
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
    try {
      console.log('🔍 [GigsService] findVenueByUserId - Input:', { venueUserId, venueId });
      const venueUserIdObj = new Types.ObjectId(venueUserId);
      const filter: Record<string, any> = {
        $or: [{ userId: venueUserIdObj }, { userId: venueUserId }],
      };
      if (venueId) {
        filter._id = venueId;
      }
      console.log('🔍 [GigsService] Query filter:', JSON.stringify(filter));
      const venue = await this.venueModel.findOne(filter).exec();
      if (venue) {
        console.log('✅ [GigsService] Found venue:', venue._id.toString(), 'Name:', venue.venueName);
      } else {
        console.log('❌ [GigsService] No venue found for filter');
      }
      return venue;
    } catch (error) {
      console.error('❌ [GigsService] findVenueByUserId error:', error.message);
      throw error;
    }
  }

  private isValidLatitude(lat: number): boolean {
    return (
      typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90
    );
  }

  private isValidLongitude(lng: number): boolean {
    return (
      typeof lng === 'number' &&
      Number.isFinite(lng) &&
      lng >= -180 &&
      lng <= 180
    );
  }
}
