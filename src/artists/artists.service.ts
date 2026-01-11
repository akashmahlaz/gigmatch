import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Artist, ArtistDocument } from '../schemas/artist.schema';
import { User, UserDocument } from '../schemas/user.schema';
import {
  CreateArtistDto,
  UpdateArtistDto,
  SearchArtistsDto,
} from './dto/artist.dto';

@Injectable()
export class ArtistsService {
  constructor(
    @InjectModel(Artist.name) private artistModel: Model<ArtistDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Get artist profile by user ID
   * If artist doesn't exist, create a basic one (handles edge cases)
   */
  async findByUserId(userId: string): Promise<ArtistDocument> {
    let artist = await this.artistModel.findOne({ user: userId }).exec();

    // If artist doesn't exist, create a basic profile
    if (!artist) {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Create basic artist profile
      artist = await this.artistModel.create({
        user: userId,
        displayName: user.fullName || 'Artist',
        isProfileVisible: false,
        hasCompletedSetup: false,
      });

      // Update user with artist reference
      user.artistProfile = artist._id;
      await user.save();
    }

    return artist;
  }

  /**
   * Get artist profile by ID
   */
  async findById(id: string): Promise<ArtistDocument> {
    const artist = await this.artistModel.findById(id).exec();
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }
    return artist;
  }

  /**
   * Get public artist profile by ID
   */
  async findPublicProfile(id: string): Promise<ArtistDocument> {
    const artist = await this.artistModel.findById(id).exec();
    if (!artist || !artist.isProfileVisible) {
      throw new NotFoundException('Artist not found');
    }

    // Increment view count
    await this.artistModel.findByIdAndUpdate(id, { $inc: { profileViews: 1 } });

    // Remove sensitive fields for public view
    const publicArtist = artist.toObject();
    if (!publicArtist.showPhoneOnProfile) {
      delete publicArtist.phone;
    }

    return publicArtist as ArtistDocument;
  }

  /**
   * Update artist profile
   */
  async update(
    userId: string,
    updateArtistDto: UpdateArtistDto,
  ): Promise<ArtistDocument> {
    const artist = await this.artistModel.findOne({ user: userId }).exec();
    if (!artist) {
      throw new NotFoundException('Artist profile not found');
    }

    // Calculate profile completion percentage
    const completionPercent = this.calculateProfileCompletion({
      ...artist.toObject(),
      ...updateArtistDto,
    } as Partial<Artist>);

    const updated = await this.artistModel
      .findByIdAndUpdate(
        artist._id,
        { ...updateArtistDto, profileCompletionPercent: completionPercent },
        { new: true },
      )
      .exec();

    return updated!;
  }

  /**
   * Complete profile setup with optional data update
   *
   * Enterprise rules:
   * - Location is REQUIRED to complete setup (city, country, coordinates [lng, lat]).
   * - Any validation problems must return clear 400 errors (not 500).
   * - We avoid writing fields that are not part of the Artist schema.
   */
  async completeSetup(
    userId: string,
    updateData?: UpdateArtistDto,
  ): Promise<ArtistDocument> {
    try {
      let artist = await this.artistModel.findOne({ user: userId }).exec();

      // If artist doesn't exist, create it (handles edge case where registration partially failed)
      if (!artist) {
        const user = await this.userModel.findById(userId).exec();
        if (!user) {
          throw new NotFoundException('User not found');
        }

        const createData: Record<string, any> = {
          user: userId,
          displayName: updateData?.displayName || user.fullName || 'Artist',
          isProfileVisible: false,
          hasCompletedSetup: false,
        };

        // Add optional fields from updateData (schema-safe)
        if (updateData?.stageName) createData.stageName = updateData.stageName;
        if (updateData?.bio) createData.bio = updateData.bio;
        if (updateData?.genres) createData.genres = updateData.genres;
        if (updateData?.location) createData.location = updateData.location;
        if (updateData?.minPrice !== undefined)
          createData.minPrice = updateData.minPrice;
        if (updateData?.maxPrice !== undefined)
          createData.maxPrice = updateData.maxPrice;
        if (updateData?.currency) createData.currency = updateData.currency;
        if (updateData?.socialLinks)
          createData.socialLinks = updateData.socialLinks;

        artist = await this.artistModel.create(createData);

        // Update user with artist reference
        user.artistProfile = artist._id;
        await user.save();
      }

      // Apply updates if provided
      const updateFields: Record<string, any> = {
        hasCompletedSetup: true,
        isProfileVisible: true,
      };

      if (updateData) {
        // Merge update data (schema-safe only)
        if (updateData.displayName)
          updateFields.displayName = updateData.displayName;
        if (updateData.stageName) updateFields.stageName = updateData.stageName;
        if (updateData.bio) updateFields.bio = updateData.bio;
        if (updateData.genres) updateFields.genres = updateData.genres;
        if (updateData.location) updateFields.location = updateData.location;
        if (updateData.minPrice !== undefined)
          updateFields.minPrice = updateData.minPrice;
        if (updateData.maxPrice !== undefined)
          updateFields.maxPrice = updateData.maxPrice;
        if (updateData.currency) updateFields.currency = updateData.currency;
        if (updateData.socialLinks)
          updateFields.socialLinks = updateData.socialLinks;
      }

      // Enforce required location for completion:
      // - Prefer the incoming payload location (updateFields.location)
      // - Fall back to existing artist.location if not provided in this request
      const effectiveLocation: any =
        updateFields['location'] ?? artist.location;

      const city = effectiveLocation?.city;
      const country = effectiveLocation?.country;
      const coords = effectiveLocation?.coordinates;

      const hasValidCity = typeof city === 'string' && city.trim().length > 0;
      const hasValidCountry =
        typeof country === 'string' && country.trim().length > 0;

      const hasValidCoords =
        Array.isArray(coords) &&
        coords.length === 2 &&
        typeof coords[0] === 'number' &&
        typeof coords[1] === 'number' &&
        Math.abs(coords[0]) > 0.000001 &&
        Math.abs(coords[1]) > 0.000001;

      if (!hasValidCity || !hasValidCountry || !hasValidCoords) {
        throw new BadRequestException(
          'Location is required to complete setup. Provide location.city, location.country and location.coordinates [longitude, latitude].',
        );
      }

      const updated = await this.artistModel
        .findByIdAndUpdate(artist._id, updateFields, { new: true })
        .exec();

      if (!updated) {
        throw new InternalServerErrorException(
          'Failed to complete artist setup',
        );
      }

      // Also update user's isProfileComplete flag
      await this.userModel.findByIdAndUpdate(userId, {
        isProfileComplete: true,
      });

      return updated;
    } catch (err: any) {
      // Preserve explicit HTTP errors; wrap unexpected ones so clients don't see 500 without context.
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
   * Search artists with filters
   */
  async search(
    searchDto: SearchArtistsDto,
  ): Promise<{
    artists: ArtistDocument[];
    total: number;
    page: number;
    pages: number;
  }> {
    const {
      genres,
      city,
      country,
      minPrice,
      maxPrice,
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

    // Genre filter
    if (genres?.length) {
      filter.genres = { $in: genres };
    }

    // Location filter
    if (city) {
      filter['location.city'] = { $regex: city, $options: 'i' };
    }
    if (country) {
      filter['location.country'] = { $regex: country, $options: 'i' };
    }

    // Price filter
    if (minPrice !== undefined) {
      filter.maxPrice = { $gte: minPrice };
    }
    if (maxPrice !== undefined) {
      filter.minPrice = { $lte: maxPrice };
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
          $maxDistance: radius * 1000, // Convert km to meters
        },
      };
    }

    // Sorting
    const sortOptions: Record<string, any> = {
      rating: { averageRating: -1 },
      price: { minPrice: 1 },
      newest: { createdAt: -1 },
    };

    const skip = (page - 1) * limit;

    // Prioritize boosted profiles
    const sort = {
      isBoosted: -1,
      ...sortOptions[sortBy],
    };

    const [artists, total] = await Promise.all([
      this.artistModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.artistModel.countDocuments(filter).exec(),
    ]);

    return {
      artists,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get artists for discovery/swiping
   */
  async getForDiscovery(
    venueUserId: string,
    filters: {
      genres?: string[];
      city?: string;
      country?: string;
      maxPrice?: number;
    },
    excludeIds: string[] = [],
    limit = 10,
  ): Promise<ArtistDocument[]> {
    const filter: Record<string, any> = {
      isProfileVisible: true,
      hasCompletedSetup: true,
      _id: { $nin: excludeIds },
    };

    if (filters.genres?.length) {
      filter.genres = { $in: filters.genres };
    }
    if (filters.city) {
      filter['location.city'] = { $regex: filters.city, $options: 'i' };
    }
    if (filters.country) {
      filter['location.country'] = { $regex: filters.country, $options: 'i' };
    }
    if (filters.maxPrice !== undefined) {
      filter.minPrice = { $lte: filters.maxPrice };
    }

    // Prioritize boosted profiles, then by rating
    return this.artistModel
      .find(filter)
      .sort({ isBoosted: -1, averageRating: -1, createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Calculate profile completion percentage
   */
  private calculateProfileCompletion(artist: Partial<Artist>): number {
    let score = 0;
    const totalFields = 10;

    if (artist.displayName) score++;
    if (artist.bio && artist.bio.length > 20) score++;
    if (artist.genres && artist.genres.length > 0) score++;
    if (artist.profilePhoto) score++;
    if (artist.photoGallery && artist.photoGallery.length > 0) score++;
    if (artist.audioSamples && artist.audioSamples.length > 0) score++;
    if (artist.location?.city) score++;
    if (artist.minPrice || artist.maxPrice) score++;
    if (artist.socialLinks && Object.values(artist.socialLinks).some((v) => v))
      score++;
    if (artist.availability && artist.availability.length > 0) score++;

    return Math.round((score / totalFields) * 100);
  }

  /**
   * Update artist stats after booking/review
   */
  async updateStats(
    artistId: string,
    stats: {
      completedGigs?: number;
      totalReviews?: number;
      averageRating?: number;
    },
  ): Promise<void> {
    await this.artistModel.findByIdAndUpdate(artistId, { $set: stats }).exec();
  }

  /**
   * Boost artist profile
   */
  async boostProfile(
    userId: string,
    durationHours = 24,
  ): Promise<ArtistDocument> {
    const artist = await this.artistModel.findOne({ user: userId }).exec();
    if (!artist) {
      throw new NotFoundException('Artist profile not found');
    }

    const boostExpiresAt = new Date();
    boostExpiresAt.setHours(boostExpiresAt.getHours() + durationHours);

    const updated = await this.artistModel
      .findByIdAndUpdate(
        artist._id,
        { isBoosted: true, boostExpiresAt },
        { new: true },
      )
      .exec();

    return updated!;
  }
}
