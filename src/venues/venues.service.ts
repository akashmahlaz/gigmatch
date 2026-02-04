import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Venue, VenueDocument } from './schemas/venue.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { UpdateVenueDto, SearchVenuesDto } from './dto/venue.dto';

@Injectable()
export class VenuesService {
  constructor(
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Get venue profile by user ID
   * If venue doesn't exist, create a basic one (handles edge cases)
   */
  async findByUserId(userId: string): Promise<VenueDocument> {
    console.log('🏢 [VenueService] findByUserId called for:', userId);
    // Search for venue with userId as either string or ObjectId for backward compatibility
    const userIdObj = new Types.ObjectId(userId);
    let venue = await this.venueModel.findOne({
      $or: [{ userId: userIdObj }, { userId }],
    }).exec();
    
    if (venue) {
      console.log('🏢 [VenueService] Found existing venue:', venue.venueName);
      console.log('  - hasCompletedSetup:', venue.hasCompletedSetup);
      console.log('  - isOpenForBookings:', venue.isOpenForBookings);
    }

    // If venue doesn't exist, create a basic profile
    if (!venue) {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Create basic venue profile - store userId as ObjectId
      venue = await this.venueModel.create({
        userId: userIdObj,
        venueName: user.fullName || 'Venue',
        venueType: 'bar',
        location: {
          city: 'Unknown',
          country: 'Unknown',
        },
        isProfileVisible: false,
        hasCompletedSetup: false,
        isOpenForBookings: false,
      });

      // Update user with venue reference
      user.venueProfile = venue._id;
      await user.save();
    }

    return venue;
  }

  /**
   * Get venue profile by ID
   */
  async findById(id: string): Promise<VenueDocument> {
    const venue = await this.venueModel.findById(id).exec();
    if (!venue) {
      throw new NotFoundException('Venue not found');
    }
    return venue;
  }

  /**
   * Get public venue profile by ID
   */
  async findPublicProfile(id: string): Promise<VenueDocument> {
    const venue = await this.venueModel.findById(id).exec();
    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    // Increment view count
    await this.venueModel.findByIdAndUpdate(id, { $inc: { profileViews: 1 } });

    // Remove sensitive fields for public view
    const publicVenue = venue.toObject();
    // Phone privacy is controlled at contact person level

    return publicVenue as VenueDocument;
  }

  /**
   * Update venue profile
   * 
   * IMPORTANT: This method normalizes field names from Flutter DTO to MongoDB schema.
   * Flutter uses: coverPhoto, photoGallery
   * MongoDB uses: photos array with profilePhotoUrl as first item
   */
  async update(
    userId: string,
    updateVenueDto: UpdateVenueDto,
  ): Promise<VenueDocument> {
    const venue = await this.venueModel.findOne({ userId }).exec();
    if (!venue) {
      throw new NotFoundException('Venue profile not found');
    }

    // Normalize field names from Flutter DTO to MongoDB schema
    const normalizedUpdate = this.normalizeVenueUpdate(updateVenueDto, venue);

    // Calculate profile completion percentage
    const completionPercent = this.calculateProfileCompletion({
      ...venue.toObject(),
      ...normalizedUpdate,
    } as Partial<Venue>);

    const updated = await this.venueModel
      .findByIdAndUpdate(
        venue._id,
        { ...normalizedUpdate, profileCompletionPercent: completionPercent },
        { new: true },
      )
      .exec();

    return updated!;
  }

  /**
   * Normalize Flutter DTO field names to MongoDB schema field names
   */
  private normalizeVenueUpdate(dto: UpdateVenueDto, existingVenue: VenueDocument): Record<string, any> {
    const normalized: Record<string, any> = { ...dto };

    // coverPhoto -> stored as first photo in photos array marked as primary
    // photoGallery -> stored as photos array
    if (dto.coverPhoto || dto.photoGallery) {
      const photos: Array<{
        url: string;
        caption?: string;
        isPrimary: boolean;
        order: number;
        uploadedAt: Date;
      }> = [];

      // Add cover photo as primary
      if (dto.coverPhoto) {
        photos.push({
          url: dto.coverPhoto,
          isPrimary: true,
          order: 0,
          uploadedAt: new Date(),
        });
      }

      // Add gallery photos
      if (dto.photoGallery) {
        dto.photoGallery.forEach((url, index) => {
          photos.push({
            url,
            isPrimary: false,
            order: (dto.coverPhoto ? 1 : 0) + index,
            uploadedAt: new Date(),
          });
        });
      }

      if (photos.length > 0) {
        normalized['photos'] = photos;
      }

      // Remove DTO-only fields
      delete normalized['coverPhoto'];
      delete normalized['photoGallery'];
    }

    return normalized;
  }

  /**
   * Complete profile setup with optional data update
   * If venue profile doesn't exist (edge case from failed registration), create it
   */
  async completeSetup(
    userId: string,
    updateData?: UpdateVenueDto,
  ): Promise<VenueDocument> {
    try {
      let venue = await this.venueModel.findOne({ userId }).exec();

      // If venue doesn't exist, create it (handles edge case where registration partially failed)
      if (!venue) {
        const user = await this.userModel.findById(userId).exec();
        if (!user) {
          throw new NotFoundException('User not found');
        }

        // Create new venue profile with provided data (schema-safe fields only)
        const createData: Record<string, any> = {
          userId: new Types.ObjectId(userId),
          venueName: updateData?.venueName || user.fullName || 'Venue',
          venueType: updateData?.venueType || 'bar',
          location: updateData?.location || {
            city: 'Unknown',
            country: 'Unknown',
          },
          isProfileVisible: false,
          hasCompletedSetup: false,
          isOpenForBookings: false,
        };

        if (updateData?.description)
          createData.description = updateData.description;
        if (updateData?.location) createData.location = updateData.location;
        if (updateData?.capacity !== undefined)
          createData.capacity = updateData.capacity;

        // NOTE: Venue schema uses `equipment`, not `amenities`.
        // Only assign if your DTO maps to schema correctly.
        if ((updateData as any)?.equipment)
          createData.equipment = (updateData as any).equipment;

        if (updateData?.preferredGenres)
          createData.preferredGenres = updateData.preferredGenres;
        if (updateData?.phone) createData.phone = updateData.phone;
        if ((updateData as any)?.contactEmail)
          createData.contactEmail = (updateData as any).contactEmail;

        if (updateData?.socialLinks)
          createData.socialLinks = updateData.socialLinks;
        if (updateData?.operatingHours)
          createData.operatingHours = updateData.operatingHours;

        venue = await this.venueModel.create(createData);

        // Update user with venue reference
        user.venueProfile = venue._id;
        await user.save();
      }

      // Apply updates (schema-safe only)
      const updateFields: Record<string, any> = {
        hasCompletedSetup: true,
        isProfileVisible: true,
        isOpenForBookings: true,
      };

      if (updateData) {
        if (updateData.venueName) updateFields.venueName = updateData.venueName;
        if (updateData.description)
          updateFields.description = updateData.description;
        if (updateData.venueType) updateFields.venueType = updateData.venueType;
        if (updateData.location) updateFields.location = updateData.location;
        if (updateData.capacity !== undefined)
          updateFields.capacity = updateData.capacity;

        // See note above about `amenities` vs `equipment`.
        if ((updateData as any)?.equipment)
          updateFields.equipment = (updateData as any).equipment;

        if (updateData.preferredGenres)
          updateFields.preferredGenres = updateData.preferredGenres;

        // Budget fields in schema: minBudget/maxBudget (not budgetRange object).
        // If your DTO uses `budgetRange`, map it explicitly.
        if ((updateData as any)?.budgetRange?.min !== undefined) {
          updateFields.minBudget = (updateData as any).budgetRange.min;
        }
        if ((updateData as any)?.budgetRange?.max !== undefined) {
          updateFields.maxBudget = (updateData as any).budgetRange.max;
        }
        if ((updateData as any)?.budgetRange?.currency) {
          updateFields.currency = (updateData as any).budgetRange.currency;
        }

        if (updateData.socialLinks)
          updateFields.socialLinks = updateData.socialLinks;
        if (updateData.operatingHours)
          updateFields.operatingHours = updateData.operatingHours;
        if (updateData.phone) updateFields.phone = updateData.phone;
        if ((updateData as any)?.contactEmail)
          updateFields.contactEmail = (updateData as any).contactEmail;

        // Only set if your schema actually includes it.
        if ((updateData as any)?.equipment)
          updateFields.equipment = (updateData as any).equipment;
      }

      // Enforce required location for completion (city, country, coordinates [lng, lat])
      // Note: We allow [0,0] coordinates as some venues might be at those locations
      const effectiveLocation: any = updateFields.location ?? venue.location;

      const city = effectiveLocation?.city;
      const country = effectiveLocation?.country;
      const coords = effectiveLocation?.coordinates;

      const hasValidCity = typeof city === 'string' && city.trim().length > 0;
      const hasValidCountry =
        typeof country === 'string' && country.trim().length > 0;

      // Valid coordinates: array of 2 numbers (allow [0,0] for venues at those locations)
      const hasValidCoords =
        Array.isArray(coords) &&
        coords.length === 2 &&
        typeof coords[0] === 'number' &&
        typeof coords[1] === 'number';

      if (!hasValidCity || !hasValidCountry || !hasValidCoords) {
        throw new BadRequestException(
          'Location is required to complete setup. Provide location.city, location.country and location.coordinates [longitude, latitude].',
        );
      }

      console.log('🏢 [VenueService] Updating venue with fields:', JSON.stringify(updateFields, null, 2));
      
      const updated = await this.venueModel
        .findByIdAndUpdate(venue._id, updateFields, { new: true })
        .exec();

      if (!updated) {
        throw new InternalServerErrorException(
          'Failed to complete venue setup',
        );
      }

      console.log('🏢 [VenueService] Updated venue flags:');
      console.log('  - hasCompletedSetup:', updated.hasCompletedSetup);
      console.log('  - isOpenForBookings:', updated.isOpenForBookings);
      console.log('  - isProfileVisible:', updated.isProfileVisible);

      // Also update user's isProfileComplete flag
      await this.userModel.findByIdAndUpdate(userId, {
        isProfileComplete: true,
      });

      return updated;
    } catch (err: any) {
      if (
        err instanceof BadRequestException ||
        err instanceof ForbiddenException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      throw new InternalServerErrorException('Internal server error');
    }
  }

  /**
   * Search venues with filters
   */
  async search(
    searchDto: SearchVenuesDto,
  ): Promise<{
    venues: VenueDocument[];
    total: number;
    page: number;
    pages: number;
  }> {
    const {
      venueTypes,
      preferredGenres,
      city,
      country,
      minBudget,
      maxBudget,
      minCapacity,
      minRating,
      latitude,
      longitude,
      radius,
      page = 1,
      limit = 20,
      sortBy = 'newest',
    } = searchDto;

    const filter: Record<string, any> = {
      isProfileVisible: true,
      hasCompletedSetup: true,
    };

    // Venue type filter
    if (venueTypes?.length) {
      filter.venueType = { $in: venueTypes };
    }

    // Genre filter
    if (preferredGenres?.length) {
      filter.preferredGenres = { $in: preferredGenres };
    }

    // Location filter
    if (city) {
      filter['location.city'] = { $regex: city, $options: 'i' };
    }
    if (country) {
      filter['location.country'] = { $regex: country, $options: 'i' };
    }

    // Budget filter
    if (minBudget !== undefined) {
      filter.maxBudget = { $gte: minBudget };
    }
    if (maxBudget !== undefined) {
      filter.minBudget = { $lte: maxBudget };
    }

    // Capacity filter
    if (minCapacity !== undefined) {
      filter.capacity = { $gte: minCapacity };
    }

    // Rating filter
    if (minRating !== undefined) {
      filter.averageRating = { $gte: minRating };
    }

    // Geospatial query
    if (latitude && longitude && radius) {
      filter['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: radius * 1000,
        },
      };
    }

    // Sorting
    const sortOptions: Record<string, any> = {
      rating: { averageRating: -1 },
      budget: { maxBudget: -1 },
      capacity: { capacity: -1 },
      newest: { createdAt: -1 },
    };

    const skip = (page - 1) * limit;

    const [venues, total] = await Promise.all([
      this.venueModel
        .find(filter)
        .sort(sortOptions[sortBy])
        .skip(skip)
        .limit(limit)
        .exec(),
      this.venueModel.countDocuments(filter).exec(),
    ]);

    return {
      venues,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get venues for discovery/swiping by artists
   */
  async getForDiscovery(
    artistUserId: string,
    filters: {
      venueTypes?: string[];
      preferredGenres?: string[];
      city?: string;
      country?: string;
      minBudget?: number;
    },
    excludeIds: string[] = [],
    limit = 10,
  ): Promise<VenueDocument[]> {
    const filter: Record<string, any> = {
      isProfileVisible: true,
      hasCompletedSetup: true,
      isOpenForBookings: true,
      _id: { $nin: excludeIds },
    };

    if (filters.venueTypes?.length) {
      filter.venueType = { $in: filters.venueTypes };
    }
    if (filters.preferredGenres?.length) {
      filter.preferredGenres = { $in: filters.preferredGenres };
    }
    if (filters.city) {
      filter['location.city'] = { $regex: filters.city, $options: 'i' };
    }
    if (filters.country) {
      filter['location.country'] = { $regex: filters.country, $options: 'i' };
    }
    if (filters.minBudget !== undefined) {
      filter.maxBudget = { $gte: filters.minBudget };
    }

    return this.venueModel
      .find(filter)
      .sort({ averageRating: -1, createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Calculate profile completion percentage
   */
  private calculateProfileCompletion(venue: Partial<Venue>): number {
    let score = 0;
    const totalFields = 10;

    if (venue.venueName) score++;
    if (venue.venueType) score++;
    if (venue.description && venue.description.length > 20) score++;
    if (venue.photos && venue.photos.length > 0) score++;
    // Already counted in photos check above
    if (venue.location?.city && venue.location?.country) score++;
    if (venue.capacity) score++;
    if (venue.equipment && Object.values(venue.equipment).some((v) => v))
      score++;
    if (venue.operatingHours && Object.keys(venue.operatingHours).length > 0)
      score++;
    if (venue.budgetMax) score++;

    return Math.round((score / totalFields) * 100);
  }

  /**
   * Update venue stats after booking/review
   */
  async updateStats(
    venueId: string,
    stats: {
      completedBookings?: number;
      totalReviews?: number;
      averageRating?: number;
    },
  ): Promise<void> {
    await this.venueModel.findByIdAndUpdate(venueId, { $set: stats }).exec();
  }
}
