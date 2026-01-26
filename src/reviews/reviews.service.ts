import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './review.schema';
import { Artist, ArtistDocument } from '../artists/schemas/artist.schema';
import { Venue, VenueDocument } from '../venues/schemas/venue.schema';
import { Gig, GigDocument } from '../schemas/gig.schema';
import { User, UserDocument } from '../schemas/user.schema';
import {
  CreateReviewDto,
  RespondToReviewDto,
  GetReviewsQueryDto,
  ReviewStatsDto,
} from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Artist.name) private artistModel: Model<ArtistDocument>,
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
    @InjectModel(Gig.name) private gigModel: Model<GigDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Create a review after a completed gig
   * Only verified bookers can leave reviews
   */
  async createReview(
    userId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get the gig
    const gig = await this.gigModel.findById(dto.gigId).lean().exec();
    if (!gig) {
      throw new NotFoundException('Gig not found');
    }

    // Verify gig is completed
    if ((gig as any).status !== 'completed') {
      throw new BadRequestException('Can only review completed gigs');
    }

    // Check if user was part of this gig
    const isVenue = user.role === 'venue' && (gig as any).venue?.toString() === user.venueProfile?.toString();
    const bookedArtists = (gig as any).bookedArtists || [];
    const isArtist = user.role === 'artist' && bookedArtists.some((a: any) => a.toString() === user.artistProfile?.toString());

    if (!isVenue && !isArtist) {
      throw new ForbiddenException('You were not part of this gig');
    }

    // Check for existing review
    const existingReview = await this.reviewModel.findOne({
      gigId: dto.gigId,
      reviewerId: userId,
    }).exec();

    if (existingReview) {
      throw new ConflictException('You have already reviewed this gig');
    }

    // Determine target
    let targetId: Types.ObjectId;
    let targetType: 'Artist' | 'Venue';

    if (isVenue) {
      // Venue reviewing artist - use first booked artist
      if (bookedArtists.length === 0) {
        throw new BadRequestException('No artists booked for this gig');
      }
      targetId = bookedArtists[0];
      targetType = 'Artist';
    } else {
      // Artist reviewing venue
      targetId = (gig as any).venue;
      targetType = 'Venue';
    }

    // Create review
    const review = await this.reviewModel.create({
      reviewerId: new Types.ObjectId(userId),
      reviewerRole: user.role,
      reviewerName: user.fullName || 'Anonymous',
      reviewerPhoto: user.profilePhotoUrl,
      targetId,
      targetType,
      gigId: new Types.ObjectId(dto.gigId),
      gigTitle: gig.title,
      gigDate: gig.date,
      overallRating: dto.overallRating,
      performanceRating: dto.performanceRating,
      professionalismRating: dto.professionalismRating,
      reliabilityRating: dto.reliabilityRating,
      venueQualityRating: dto.venueQualityRating,
      paymentRating: dto.paymentRating,
      content: dto.content,
      tags: dto.tags || [],
      photos: dto.photos || [],
      isVerifiedBooking: true,
      status: 'published',
    });

    // Update target's rating stats
    await this.updateTargetStats(targetId.toString(), targetType);

    return review;
  }

  /**
   * Get reviews for an artist
   */
  async getArtistReviews(
    artistId: string,
    query: GetReviewsQueryDto,
  ): Promise<{ reviews: ReviewDocument[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 10, sortBy = 'newest', rating } = query;

    const filter: any = {
      targetId: new Types.ObjectId(artistId),
      targetType: 'Artist',
      status: 'published',
    };

    if (rating) {
      filter.overallRating = rating;
    }

    const sortOptions: Record<string, any> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { overallRating: -1, createdAt: -1 },
      lowest: { overallRating: 1, createdAt: -1 },
      helpful: { helpfulCount: -1, createdAt: -1 },
    };

    const [reviews, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort(sortOptions[sortBy] || sortOptions.newest)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
    ]);

    return {
      reviews,
      total,
      hasMore: page * limit < total,
    };
  }

  /**
   * Get reviews for a venue
   */
  async getVenueReviews(
    venueId: string,
    query: GetReviewsQueryDto,
  ): Promise<{ reviews: ReviewDocument[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 10, sortBy = 'newest', rating } = query;

    const filter: any = {
      targetId: new Types.ObjectId(venueId),
      targetType: 'Venue',
      status: 'published',
    };

    if (rating) {
      filter.overallRating = rating;
    }

    const sortOptions: Record<string, any> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { overallRating: -1, createdAt: -1 },
      lowest: { overallRating: 1, createdAt: -1 },
      helpful: { helpfulCount: -1, createdAt: -1 },
    };

    const [reviews, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort(sortOptions[sortBy] || sortOptions.newest)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
    ]);

    return {
      reviews,
      total,
      hasMore: page * limit < total,
    };
  }

  /**
   * Get review statistics for a target
   */
  async getReviewStats(
    targetId: string,
    targetType: 'Artist' | 'Venue',
  ): Promise<ReviewStatsDto> {
    const filter = {
      targetId: new Types.ObjectId(targetId),
      targetType,
      status: 'published',
    };

    const reviews = await this.reviewModel.find(filter).exec();

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        topTags: [],
      };
    }

    // Calculate averages
    const totalRating = reviews.reduce((sum, r) => sum + r.overallRating, 0);
    const averageRating = totalRating / reviews.length;

    // Rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      ratingDistribution[r.overallRating as 1 | 2 | 3 | 4 | 5]++;
    });

    // Calculate category averages
    const calcAverage = (field: keyof Review) => {
      const validReviews = reviews.filter((r) => r[field] != null);
      if (validReviews.length === 0) return undefined;
      return (
        validReviews.reduce((sum, r) => sum + (r[field] as number), 0) /
        validReviews.length
      );
    };

    // Top tags
    const tagCounts: Record<string, number> = {};
    reviews.forEach((r) => {
      r.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: reviews.length,
      ratingDistribution,
      averagePerformance: calcAverage('performanceRating'),
      averageProfessionalism: calcAverage('professionalismRating'),
      averageReliability: calcAverage('reliabilityRating'),
      averageVenueQuality: calcAverage('venueQualityRating'),
      averagePayment: calcAverage('paymentRating'),
      topTags,
    };
  }

  /**
   * Respond to a review (by the reviewed party)
   */
  async respondToReview(
    userId: string,
    reviewId: string,
    dto: RespondToReviewDto,
  ): Promise<ReviewDocument> {
    const review = await this.reviewModel.findById(reviewId).exec();
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.response) {
      throw new BadRequestException('Review already has a response');
    }

    // Verify user owns the target
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isOwner =
      (review.targetType === 'Artist' &&
        user.artistProfile?.toString() === review.targetId.toString()) ||
      (review.targetType === 'Venue' &&
        user.venueProfile?.toString() === review.targetId.toString());

    if (!isOwner) {
      throw new ForbiddenException('You can only respond to reviews about you');
    }

    review.response = dto.response;
    review.responseDate = new Date();
    await review.save();

    return review;
  }

  /**
   * Mark review as helpful
   */
  async markHelpful(userId: string, reviewId: string): Promise<void> {
    const review = await this.reviewModel.findById(reviewId).exec();
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const userObjectId = new Types.ObjectId(userId);
    const alreadyMarked = review.helpfulBy.some((id) => id.equals(userObjectId));

    if (alreadyMarked) {
      // Remove helpful
      review.helpfulBy = review.helpfulBy.filter((id) => !id.equals(userObjectId));
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      // Add helpful
      review.helpfulBy.push(userObjectId);
      review.helpfulCount++;
    }

    await review.save();
  }

  /**
   * Get my reviews (reviews I've written)
   */
  async getMyReviews(
    userId: string,
    query: GetReviewsQueryDto,
  ): Promise<{ reviews: ReviewDocument[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 10 } = query;

    const filter = { reviewerId: new Types.ObjectId(userId) };

    const [reviews, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
    ]);

    return {
      reviews,
      total,
      hasMore: page * limit < total,
    };
  }

  /**
   * Update target's rating stats after new review
   */
  private async updateTargetStats(
    targetId: string,
    targetType: 'Artist' | 'Venue',
  ): Promise<void> {
    const stats = await this.getReviewStats(targetId, targetType);

    if (targetType === 'Artist') {
      await this.artistModel.findByIdAndUpdate(targetId, {
        averageRating: stats.averageRating,
        totalReviews: stats.totalReviews,
        reliabilityScore: stats.averageReliability
          ? Math.round(stats.averageReliability * 20)
          : 100,
      });
    } else {
      await this.venueModel.findByIdAndUpdate(targetId, {
        'reviewStats.averageRating': stats.averageRating,
        'reviewStats.totalReviews': stats.totalReviews,
      });
    }
  }
}
