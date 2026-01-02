import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Swipe, SwipeDocument } from '../schemas/swipe.schema';
import { Match, MatchDocument } from '../schemas/match.schema';
import { Artist, ArtistDocument } from '../schemas/artist.schema';
import { Venue, VenueDocument } from '../schemas/venue.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Subscription, SubscriptionDocument } from '../schemas/subscription.schema';
import { CreateSwipeDto, SwipeResponseDto, DiscoveryFiltersDto } from './dto/swipe.dto';

@Injectable()
export class SwipesService {
  constructor(
    @InjectModel(Swipe.name) private swipeModel: Model<SwipeDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(Artist.name) private artistModel: Model<ArtistDocument>,
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  /**
   * Process a swipe action
   */
  async swipe(
    userId: string,
    userRole: string,
    createSwipeDto: CreateSwipeDto,
  ): Promise<SwipeResponseDto> {
    const { targetId, targetType, action, relatedGigId } = createSwipeDto;

    // Validate swipe (artist -> venue or venue -> artist)
    if (userRole === 'artist' && targetType !== 'venue') {
      throw new BadRequestException('Artists can only swipe on venues');
    }
    if (userRole === 'venue' && targetType !== 'artist') {
      throw new BadRequestException('Venues can only swipe on artists');
    }

    // Check daily swipe limit for artists
    if (userRole === 'artist') {
      await this.checkSwipeLimit(userId);
    }

    // Get target user
    const targetProfile =
      targetType === 'artist'
        ? await this.artistModel.findById(targetId).exec()
        : await this.venueModel.findById(targetId).exec();

    if (!targetProfile) {
      throw new BadRequestException('Target profile not found');
    }

    const targetUserId = targetProfile.user.toString();

    // Check for existing swipe
    const existingSwipe = await this.swipeModel
      .findOne({ swiper: userId, target: targetUserId })
      .exec();

    if (existingSwipe) {
      throw new BadRequestException('Already swiped on this profile');
    }

    // Create swipe
    const swipe = new this.swipeModel({
      swiper: userId,
      swiperType: userRole,
      target: targetUserId,
      targetType,
      action,
      relatedGig: relatedGigId,
    });

    await swipe.save();

    // Update swipe count for artist
    if (userRole === 'artist') {
      await this.subscriptionModel.findOneAndUpdate(
        { user: userId },
        { $inc: { swipesToday: 1 } },
      );
    }

    // Check for mutual like (match)
    let isMatch = false;
    let matchId: string | undefined;
    let matchedUser: SwipeResponseDto['matchedUser'] | undefined;

    if (action === 'like' || action === 'superlike') {
      const reverseSwipe = await this.swipeModel
        .findOne({
          swiper: targetUserId,
          target: userId,
          action: { $in: ['like', 'superlike'] },
        })
        .exec();

      if (reverseSwipe) {
        isMatch = true;

        // Update both swipes
        swipe.isMatch = true;
        swipe.matchedAt = new Date();
        await swipe.save();

        reverseSwipe.isMatch = true;
        reverseSwipe.matchedAt = new Date();
        await reverseSwipe.save();

        // Create match
        const match = await this.createMatch(userId, userRole, targetUserId, targetType);
        matchId = match._id.toString();

        // Get matched user info
        const targetUser = await this.userModel.findById(targetUserId).exec();
        matchedUser = {
          id: targetUserId,
          name:
            targetType === 'artist'
              ? (targetProfile as ArtistDocument).displayName
              : (targetProfile as VenueDocument).venueName,
          profilePhoto:
            targetType === 'artist'
              ? (targetProfile as ArtistDocument).profilePhoto
              : (targetProfile as VenueDocument).coverPhoto,
          type: targetType,
        };
      }
    }

    return {
      swipeId: swipe._id.toString(),
      isMatch,
      matchId,
      matchedUser,
    };
  }

  /**
   * Get discovery cards for user
   */
  async getDiscoveryCards(
    userId: string,
    userRole: string,
    filters: DiscoveryFiltersDto,
    limit = 10,
  ): Promise<(ArtistDocument | VenueDocument)[]> {
    // Get already swiped profiles
    const swipedIds = await this.getSwipedProfileIds(userId);

    if (userRole === 'artist') {
      // Artists discover venues
      return this.getVenuesForDiscovery(userId, filters, swipedIds, limit);
    } else {
      // Venues discover artists
      return this.getArtistsForDiscovery(userId, filters, swipedIds, limit);
    }
  }

  /**
   * Get who liked the user (premium feature)
   */
  async getWhoLikedMe(userId: string): Promise<SwipeDocument[]> {
    return this.swipeModel
      .find({
        target: userId,
        action: { $in: ['like', 'superlike'] },
        isMatch: false,
      })
      .populate('swiper')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  /**
   * Undo last swipe (premium feature)
   */
  async undoLastSwipe(userId: string): Promise<void> {
    const lastSwipe = await this.swipeModel
      .findOne({ swiper: userId })
      .sort({ createdAt: -1 })
      .exec();

    if (!lastSwipe) {
      throw new BadRequestException('No swipe to undo');
    }

    // Can't undo if already matched
    if (lastSwipe.isMatch) {
      throw new BadRequestException('Cannot undo a matched swipe');
    }

    await this.swipeModel.findByIdAndDelete(lastSwipe._id);
  }

  /**
   * Check swipe limit for artists
   */
  private async checkSwipeLimit(userId: string): Promise<void> {
    const subscription = await this.subscriptionModel.findOne({ user: userId }).exec();

    if (!subscription) {
      throw new ForbiddenException('No subscription found');
    }

    // Reset daily count if needed
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!subscription.lastSwipeResetAt || subscription.lastSwipeResetAt < today) {
      subscription.swipesToday = 0;
      subscription.lastSwipeResetAt = today;
      await subscription.save();
    }

    if (subscription.swipesToday >= subscription.features.dailySwipeLimit) {
      throw new ForbiddenException(
        `Daily swipe limit reached (${subscription.features.dailySwipeLimit}). Upgrade for unlimited swipes!`,
      );
    }
  }

  /**
   * Get IDs of already swiped profiles
   */
  private async getSwipedProfileIds(userId: string): Promise<string[]> {
    const swipes = await this.swipeModel.find({ swiper: userId }).select('target').exec();
    return swipes.map((s) => s.target.toString());
  }

  /**
   * Get venues for artist discovery
   */
  private async getVenuesForDiscovery(
    userId: string,
    filters: DiscoveryFiltersDto,
    excludeUserIds: string[],
    limit: number,
  ): Promise<VenueDocument[]> {
    const filter: any = {
      isProfileVisible: true,
      hasCompletedSetup: true,
      isAcceptingBookings: true,
      user: { $nin: excludeUserIds },
    };

    if (filters.venueTypes?.length) {
      filter.venueType = { $in: filters.venueTypes };
    }
    if (filters.genres?.length) {
      filter.preferredGenres = { $in: filters.genres };
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
   * Get artists for venue discovery
   */
  private async getArtistsForDiscovery(
    userId: string,
    filters: DiscoveryFiltersDto,
    excludeUserIds: string[],
    limit: number,
  ): Promise<ArtistDocument[]> {
    const filter: any = {
      isProfileVisible: true,
      hasCompletedSetup: true,
      user: { $nin: excludeUserIds },
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

    // Prioritize boosted profiles
    return this.artistModel
      .find(filter)
      .sort({ isBoosted: -1, averageRating: -1, createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Create a match between two users
   */
  private async createMatch(
    userId: string,
    userRole: string,
    targetUserId: string,
    targetType: string,
  ): Promise<MatchDocument> {
    let artistId: string;
    let venueId: string;
    let artistUserId: string;
    let venueUserId: string;

    if (userRole === 'artist') {
      artistUserId = userId;
      venueUserId = targetUserId;

      const artist = await this.artistModel.findOne({ user: userId }).exec();
      const venue = await this.venueModel.findOne({ user: targetUserId }).exec();

      artistId = artist!._id.toString();
      venueId = venue!._id.toString();
    } else {
      venueUserId = userId;
      artistUserId = targetUserId;

      const venue = await this.venueModel.findOne({ user: userId }).exec();
      const artist = await this.artistModel.findOne({ user: targetUserId }).exec();

      venueId = venue!._id.toString();
      artistId = artist!._id.toString();
    }

    const match = new this.matchModel({
      artist: artistId,
      venue: venueId,
      artistUser: artistUserId,
      venueUser: venueUserId,
      status: 'active',
      initiatedBy: userRole,
      unreadCount: { artist: 0, venue: 0 },
    });

    await match.save();
    return match;
  }
}
