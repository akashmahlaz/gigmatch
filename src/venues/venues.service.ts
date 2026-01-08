import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Venue, VenueDocument } from '../schemas/venue.schema';
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
    let venue = await this.venueModel.findOne({ user: userId }).exec();

    // If venue doesn't exist, create a basic profile
    if (!venue) {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Create basic venue profile
      venue = await this.venueModel.create({
        user: userId,
        venueName: user.fullName || 'Venue',
        venueType: 'bar',
        isProfileVisible: false,
        hasCompletedSetup: false,
        isAcceptingBookings: false,
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
    if (!venue || !venue.isProfileVisible) {
      throw new NotFoundException('Venue not found');
    }

    // Increment view count
    await this.venueModel.findByIdAndUpdate(id, { $inc: { profileViews: 1 } });

    // Remove sensitive fields for public view
    const publicVenue = venue.toObject();
    if (!publicVenue.showPhoneOnProfile) {
      delete publicVenue.phone;
    }

    return publicVenue as VenueDocument;
  }

  /**
   * Update venue profile
   */
  async update(
    userId: string,
    updateVenueDto: UpdateVenueDto,
  ): Promise<VenueDocument> {
    const venue = await this.venueModel.findOne({ user: userId }).exec();
    if (!venue) {
      throw new NotFoundException('Venue profile not found');
    }

    // Calculate profile completion percentage
    const completionPercent = this.calculateProfileCompletion({
      ...venue.toObject(),
      ...updateVenueDto,
    } as Partial<Venue>);

    const updated = await this.venueModel
      .findByIdAndUpdate(
        venue._id,
        { ...updateVenueDto, profileCompletionPercent: completionPercent },
        { new: true },
      )
      .exec();

    return updated!;
  }

  /**
   * Complete profile setup with optional data update
   * If venue profile doesn't exist (edge case from failed registration), create it
   */
  async completeSetup(userId: string, updateData?: UpdateVenueDto): Promise<VenueDocument> {
    let venue = await this.venueModel.findOne({ user: userId }).exec();

    // If venue doesn't exist, create it (handles edge case where registration partially failed)
    if (!venue) {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Create new venue profile with provided data
      const createData: Record<string, any> = {
        user: userId,
        venueName: updateData?.venueName || user.fullName || 'Venue',
        venueType: updateData?.venueType || 'bar',
        isProfileVisible: false,
        hasCompletedSetup: false,
        isAcceptingBookings: false,
      };

      // Add optional fields from updateData
      if (updateData?.description) createData.description = updateData.description;
      if (updateData?.location) createData.location = updateData.location;
      if (updateData?.capacity !== undefined) createData.capacity = updateData.capacity;
      if (updateData?.amenities) createData.amenities = updateData.amenities;
      if (updateData?.preferredGenres) createData.preferredGenres = updateData.preferredGenres;
      if (updateData?.phone) createData.phone = updateData.phone;
      if (updateData?.email) createData.email = updateData.email;

      venue = await this.venueModel.create(createData);

      // Update user with venue reference
      user.venueProfile = venue._id;
      await user.save();
    }

    // Apply updates if provided
    const updateFields: Record<string, any> = {
      hasCompletedSetup: true,
      isProfileVisible: true,
      isAcceptingBookings: true,
    };

    if (updateData) {
      // Merge update data
      if (updateData.venueName) updateFields.venueName = updateData.venueName;
      if (updateData.description) updateFields.description = updateData.description;
      if (updateData.venueType) updateFields.venueType = updateData.venueType;
      if (updateData.location) updateFields.location = updateData.location;
      if (updateData.capacity !== undefined) updateFields.capacity = updateData.capacity;
      if (updateData.amenities) updateFields.amenities = updateData.amenities;
      if (updateData.preferredGenres) updateFields.preferredGenres = updateData.preferredGenres;
      if (updateData.budgetRange) updateFields.budgetRange = updateData.budgetRange;
      if (updateData.socialLinks) updateFields.socialLinks = updateData.socialLinks;
      if (updateData.operatingHours) updateFields.operatingHours = updateData.operatingHours;
      if (updateData.phone) updateFields.phone = updateData.phone;
      if (updateData.email) updateFields.email = updateData.email;
      if (updateData.gigPreferences) updateFields.gigPreferences = updateData.gigPreferences;
    }

    const updated = await this.venueModel
      .findByIdAndUpdate(
        venue._id,
        updateFields,
        { new: true },
      )
      .exec();

    // Also update user's isProfileComplete flag
    await this.userModel.findByIdAndUpdate(userId, { isProfileComplete: true });

    return updated!;
  }

  /**
   * Search venues with filters
   */
  async search(
    searchDto: SearchVenuesDto,
  ): Promise<{ venues: VenueDocument[]; total: number; page: number; pages: number }> {
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
      isAcceptingBookings: true,
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
    if (venue.coverPhoto) score++;
    if (venue.photoGallery && venue.photoGallery.length > 0) score++;
    if (venue.location?.city && venue.location?.country) score++;
    if (venue.capacity) score++;
    if (venue.equipment && Object.values(venue.equipment).some((v) => v)) score++;
    if (venue.operatingHours && Object.keys(venue.operatingHours).length > 0) score++;
    if (venue.maxBudget) score++;

    return Math.round((score / totalFields) * 100);
  }

  /**
   * Update venue stats after booking/review
   */
  async updateStats(
    venueId: string,
    stats: { completedBookings?: number; totalReviews?: number; averageRating?: number },
  ): Promise<void> {
    await this.venueModel.findByIdAndUpdate(venueId, { $set: stats }).exec();
  }
}
