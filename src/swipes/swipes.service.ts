/// 🔄 GIGMATCH SWIPE SERVICE - BULLETPROOF VERSION
///
/// Handles all swipe/discovery operations for the Tinder-style matching system:
/// - Swipe right (save/contact)
/// - Swipe left (skip)
/// - Undo swipe functionality
/// - Mutual match detection
/// - Smart recommendation algorithm (Phase 1: rule-based)
/// - Discovery feed generation
///
/// Features:
/// - Comprehensive error handling
/// - Transaction support for critical operations
/// - Rate limiting per user
/// - Duplicate swipe prevention
/// - 2dsphere geospatial queries
/// - Recommendation scoring algorithm

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';

// Schemas
import {
  Swipe,
  SwipeDocument,
  SwipeType,
  SwipeResult,
} from './schemas/swipe.schema';
import { Match, MatchDocument } from '../matches/schemas/match.schema';
import { Artist, ArtistDocument } from '../artists/schemas/artist.schema';
import { Venue, VenueDocument } from '../venues/schemas/venue.schema';
import { Gig, GigDocument } from '../gigs/schemas/gig.schema';

// DTOs
import {
  CreateSwipeDto,
  SwipeQueryDto,
  UndoSwipeDto,
  DiscoverQueryDto,
} from './dto/swipe.dto';
import { RecommendationScoreDto } from './dto/recommendation.dto';

// Enums
import { UserRole } from '../auth/schemas/user.schema';

@Injectable()
export class SwipesService {
  private readonly logger = new Logger(SwipesService.name);

  // Rate limiting configuration
  private readonly maxSwipesPerDay = {
    [UserRole.ARTIST]: 100,
    [UserRole.VENUE]: 200,
  };

  private readonly maxUndoPerDay = 5;

  constructor(
    @InjectModel(Swipe.name) private swipeModel: Model<SwipeDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(Artist.name) private artistModel: Model<ArtistDocument>,
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
    @InjectModel(Gig.name) private gigModel: Model<GigDocument>,
    private readonly configService: ConfigService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // CORE SWIPE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Perform a swipe action (right = like/save, left = skip)
   *
   * @param userId - The user performing the swipe
   * @param role - The user's role (artist or venue)
   * @param dto - Swipe details
   * @returns Swipe result with match information if applicable
   */
  async swipe(
    userId: string,
    role: UserRole,
    dto: CreateSwipeDto,
  ): Promise<{
    success: boolean;
    swipe: Swipe;
    result: SwipeResult;
    match?: Match;
  }> {
    const startTime = Date.now();

    // Validate target exists
    await this.validateSwipeTarget(role, dto.targetId);

    // Check for existing swipe (prevent duplicates)
    const existingSwipe = await this.swipeModel.findOne({
      userId: new Types.ObjectId(userId),
      targetId: new Types.ObjectId(dto.targetId),
      targetType: role === UserRole.ARTIST ? 'venue' : 'artist',
    });

    if (existingSwipe) {
      throw new ConflictException('You have already swiped on this profile');
    }

    // Check rate limiting
    await this.checkRateLimit(userId, role);

    // Get target user ID for match checking
    const targetUserId = await this.getTargetUserId(role, dto.targetId);

    // Check for mutual swipe (match)
    const oppositeSwipe = await this.swipeModel.findOne({
      userId: targetUserId,
      targetId: new Types.ObjectId(userId),
      swipeType: SwipeType.RIGHT,
    });

    let result: SwipeResult;
    let match: Match | null = null;

    if (oppositeSwipe && dto.swipeType === SwipeType.RIGHT) {
      // Mutual match!
      result = SwipeResult.MATCH;

      // Create match in transaction
      const session = await this.swipeModel.db.startSession();
      try {
        await session.withTransaction(async () => {
          // Create the match
          match = await this.createMatch(
            userId,
            targetUserId.toString(),
            role,
            dto.targetId,
            session,
          );

          // Mark opposite swipe as matched
          await this.swipeModel.updateOne(
            { _id: oppositeSwipe._id },
            {
              $set: {
                result: SwipeResult.MATCH,
                matchedWith: new Types.ObjectId(userId),
              },
            },
            { session },
          );
        });
        await session.endSession();
      } catch (error) {
        await session.abortTransaction();
        await session.endSession();
        this.logger.error(`Match creation failed: ${error}`);
        throw new BadRequestException('Failed to create match');
      }
    } else if (dto.swipeType === SwipeType.RIGHT) {
      result = SwipeResult.LIKED;
    } else {
      result = SwipeResult.SKIPPED;
    }

    // Create swipe record
    const swipe = await this.swipeModel.create([
      {
        userId: new Types.ObjectId(userId),
        targetId: new Types.ObjectId(dto.targetId),
        targetType: role === UserRole.ARTIST ? 'venue' : 'artist',
        swipeType: dto.swipeType,
        result,
        metadata: {
          source: dto.source ?? 'discover',
          timestamp: new Date(),
          processingTimeMs: Date.now() - startTime,
        },
      },
    ]);

    // Update daily swipe count for rate limiting
    await this.incrementSwipeCount(userId, role);

    this.logger.log(
      `Swipe completed: user=${userId}, target=${dto.targetId}, type=${dto.swipeType}, result=${result}, time=${Date.now() - startTime}ms`,
    );

    return {
      success: true,
      swipe: swipe[0],
      result,
      match: match ?? undefined,
    };
  }

  /**
   * Undo a recent swipe action
   *
   * @param userId - The user performing the undo
   * @param dto - Undo details including swipe ID
   */
  async undoSwipe(
    userId: string,
    dto: UndoSwipeDto,
  ): Promise<{ success: boolean; message: string }> {
    const startTime = Date.now();

    // Check undo rate limit
    await this.checkUndoRateLimit(userId);

    // Find the swipe
    const swipe = await this.swipeModel.findById(dto.swipeId);
    if (!swipe) {
      throw new NotFoundException('Swipe not found');
    }

    // Verify ownership
    if (swipe.userId.toString() !== userId) {
      throw new ForbiddenException('You can only undo your own swipes');
    }

    // Check if swipe can be undone (within time window)
    const undoWindowMs = 5 * 60 * 1000; // 5 minutes
    const timeSinceSwipe = Date.now() - swipe.createdAt.getTime();

    if (timeSinceSwipe > undoWindowMs) {
      throw new BadRequestException(
        'Swipes can only be undone within 5 minutes',
      );
    }

    // Check if already matched
    if (swipe.result === SwipeResult.MATCH) {
      throw new BadRequestException('Cannot undo a matched swipe');
    }

    // Delete swipe
    await this.swipeModel.deleteOne({ _id: swipe._id });

    // If there was an opposite swipe that was waiting, update it
    if (swipe.swipeType === SwipeType.RIGHT) {
      await this.swipeModel.updateOne(
        {
          userId: swipe.targetId,
          targetId: swipe.userId,
          swipeType: SwipeType.RIGHT,
          result: SwipeResult.LIKED,
        },
        { $set: { result: SwipeResult.EXPIRED } },
      );
    }

    this.logger.log(
      `Swipe undone: user=${userId}, swipeId=${dto.swipeId}, time=${Date.now() - startTime}ms`,
    );

    return {
      success: true,
      message: 'Swipe undone successfully',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DISCOVERY FEED
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get personalized discovery feed for artists
   * Shows available gigs based on preferences, location, and availability
   */
  async getArtistDiscoveryFeed(
    artistId: string,
    query: DiscoverQueryDto,
  ): Promise<{ gigs: any[]; total: number; page: number }> {
    const startTime = Date.now();

    // Get artist profile for preferences
    const artist = await this.artistModel.findById(artistId);
    if (!artist) {
      throw new NotFoundException('Artist profile not found');
    }

    // Build match query
    const matchQuery: any = {
      status: 'open',
      isActive: true,
    };

    // Genre matching
    if (query.genres && query.genres.length > 0) {
      matchQuery.genres = { $in: query.genres };
    } else if (artist.genres && artist.genres.length > 0) {
      matchQuery.genres = { $in: artist.genres };
    }

    // Location-based filtering
    if (
      query.latitude != null &&
      query.longitude != null &&
      query.radiusMiles != null
    ) {
      matchQuery.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [query.longitude, query.latitude],
          },
          $maxDistance: query.radiusMiles * 1609.34, // Convert miles to meters
        },
      };
    } else if (artist.location?.coordinates) {
      // Use artist's location with default radius
      const radiusMiles = query.radiusMiles ?? artist.travelRadiusMiles ?? 50;
      matchQuery.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: artist.location.coordinates,
          },
          $maxDistance: radiusMiles * 1609.34,
        },
      };
    }

    // Budget filtering
    if (query.minBudget != null || query.maxBudget != null) {
      matchQuery.budgetMax = { $gte: query.minBudget ?? 0 };
      if (query.maxBudget != null) {
        matchQuery.$expr = {
          $and: [
            { $gte: ['$budgetMax', query.minBudget ?? 0] },
            { $lte: ['$budgetMax', query.maxBudget] },
          ],
        };
      }
    }

    // Date filtering
    if (query.dateFrom) {
      matchQuery.date = { $gte: new Date(query.dateFrom) };
    }
    if (query.dateTo) {
      matchQuery.date = {
        ...matchQuery.date,
        $lte: new Date(query.dateTo),
      };
    }

    // Exclude already swiped gigs
    const swipedGigIds = await this.getSwipedGigIds(artistId);
    if (swipedGigIds.length > 0) {
      matchQuery._id = { $nin: swipedGigIds };
    }

    // Execute query with pagination
    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 20);
    const limit = query.limit ?? 20;

    const [gigs, total] = await Promise.all([
      this.gigModel
        .find(matchQuery)
        .sort({ createdAt: -1, date: 1 })
        .skip(skip)
        .limit(limit)
        .populate('venueId', 'venueName location profilePhotoUrl')
        .lean(),
      this.gigModel.countDocuments(matchQuery),
    ]);

    // Add recommendation scores
    const scoredGigs = gigs.map((gig) => ({
      ...gig,
      recommendationScore: this.calculateGigRecommendationScore(gig, artist),
    }));

    // Sort by recommendation score
    scoredGigs.sort((a, b) => b.recommendationScore - a.recommendationScore);

    this.logger.log(
      `Artist discovery feed: artist=${artistId}, count=${gigs.length}, total=${total}, time=${Date.now() - startTime}ms`,
    );

    return {
      gigs: scoredGigs,
      total,
      page: query.page ?? 1,
    };
  }

  /**
   * Get personalized discovery feed for venues
   * Shows available artists based on preferences and location
   */
  async getVenueDiscoveryFeed(
    venueId: string,
    query: DiscoverQueryDto,
  ): Promise<{ artists: any[]; total: number; page: number }> {
    const startTime = Date.now();

    // Get venue profile for preferences
    const venue = await this.venueModel.findById(venueId);
    if (!venue) {
      throw new NotFoundException('Venue profile not found');
    }

    // Build match query
    const matchQuery: any = {
      isProfileVisible: true,
      hasCompletedSetup: true,
      isVerified: true, // Prioritize verified artists
    };

    // Genre matching
    if (query.genres && query.genres.length > 0) {
      matchQuery.genres = { $in: query.genres };
    } else if (venue.preferredGenres && venue.preferredGenres.length > 0) {
      matchQuery.genres = { $in: venue.preferredGenres };
    }

    // Location-based filtering
    if (
      query.latitude != null &&
      query.longitude != null &&
      query.radiusMiles != null
    ) {
      matchQuery['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [query.longitude, query.latitude],
          },
          $maxDistance: query.radiusMiles * 1609.34,
        },
      };
    } else if (venue.location?.coordinates) {
      const radiusMiles = query.radiusMiles ?? 50;
      matchQuery['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: venue.location.coordinates,
          },
          $maxDistance: radiusMiles * 1609.34,
        },
      };
    }

    // Budget filtering (artist's min price within venue's budget)
    if (venue.budgetMax && venue.budgetMax > 0) {
      matchQuery.minPrice = { $lte: venue.budgetMax };
    }

    // Exclude already swiped artists
    const swipedArtistIds = await this.getSwipedProfileIds(venueId);
    if (swipedArtistIds.length > 0) {
      matchQuery._id = { $nin: swipedArtistIds };
    }

    // Execute query with pagination
    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 20);
    const limit = query.limit ?? 20;

    const [artists, total] = await Promise.all([
      this.artistModel
        .find(matchQuery)
        .sort({ 'reviewStats.averageRating': -1, profileCompleteness: -1 })
        .skip(skip)
        .limit(limit)
        .select('-email -phone -socialLinks')
        .lean(),
      this.artistModel.countDocuments(matchQuery),
    ]);

    // Add recommendation scores
    const scoredArtists = artists.map((artist) => ({
      ...artist,
      recommendationScore: this.calculateArtistRecommendationScore(
        artist,
        venue,
      ),
    }));

    // Sort by recommendation score
    scoredArtists.sort((a, b) => b.recommendationScore - a.recommendationScore);

    this.logger.log(
      `Venue discovery feed: venue=${venueId}, count=${artists.length}, total=${total}, time=${Date.now() - startTime}ms`,
    );

    return {
      artists: scoredArtists,
      total,
      page: query.page ?? 1,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SMART RECOMMENDATIONS (PHASE 1 - RULE-BASED)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Calculate recommendation score for a gig for an artist
   * Uses rule-based scoring algorithm (Phase 1)
   */
  private calculateGigRecommendationScore(gig: any, artist: any): number {
    let score = 0;
    const maxScore = 100;

    // Genre match score (0-30 points)
    if (artist.genres && gig.genres) {
      const matchingGenres = artist.genres.filter((g: string) =>
        gig.genres.includes(g),
      );
      const genreScore =
        (matchingGenres.length / Math.max(artist.genres.length, 1)) * 30;
      score += genreScore;
    }

    // Distance score (0-25 points)
    if (gig.location?.coordinates && artist.location?.coordinates) {
      const distance = this.calculateDistance(
        artist.location.coordinates[1],
        artist.location.coordinates[0],
        gig.location.coordinates[1],
        gig.location.coordinates[0],
      );
      const maxTravel = artist.travelRadiusMiles ?? 100;
      const distanceScore = Math.max(0, 25 - (distance / maxTravel) * 25);
      score += distanceScore;
    }

    // Budget score (0-20 points)
    if (gig.budgetMax && artist.minPrice) {
      const budgetRatio = Math.min(gig.budgetMax / artist.minPrice, 2);
      const budgetScore = Math.min(budgetRatio * 10, 20);
      score += budgetScore;
    }

    // Venue rating bonus (0-15 points)
    if (gig.venueId && gig.venueId.reviewStats) {
      const avgRating = gig.venueId.reviewStats.averageRating ?? 0;
      score += Math.min(avgRating * 3, 15);
    }

    // Reputation bonus (0-10 points)
    if (artist.reputation?.overall) {
      score += Math.min(artist.reputation.overall / 10, 10);
    }

    // Recency bonus (0 points if old, +5 if new)
    const daysSincePosted =
      (Date.now() - new Date(gig.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePosted < 3) {
      score += 5;
    }

    return Math.min(Math.round(score), maxScore);
  }

  /**
   * Calculate recommendation score for an artist for a venue
   */
  private calculateArtistRecommendationScore(artist: any, venue: any): number {
    let score = 0;
    const maxScore = 100;

    // Genre match score (0-30 points)
    if (venue.preferredGenres && artist.genres) {
      const matchingGenres = venue.preferredGenres.filter((g: string) =>
        artist.genres.includes(g),
      );
      const genreScore =
        (matchingGenres.length / Math.max(venue.preferredGenres.length, 1)) *
        30;
      score += genreScore;
    }

    // Rating score (0-25 points)
    const avgRating = artist.reviewStats?.averageRating ?? 0;
    score += Math.min(avgRating * 5, 25);

    // Distance score (0-20 points)
    if (artist.location?.coordinates && venue.location?.coordinates) {
      const distance = this.calculateDistance(
        venue.location.coordinates[1],
        venue.location.coordinates[0],
        artist.location.coordinates[1],
        artist.location.coordinates[0],
      );
      const maxTravel = artist.travelRadiusMiles ?? 100;
      const distanceScore = Math.max(0, 20 - (distance / maxTravel) * 20);
      score += distanceScore;
    }

    // Price compatibility (0-15 points)
    if (artist.minPrice && venue.budgetMax) {
      if (artist.minPrice <= venue.budgetMax) {
        score += 15;
      } else if (artist.minPrice <= venue.budgetMax * 1.5) {
        score += 7;
      }
    }

    // Experience bonus (0-10 points)
    const experienceScore = Math.min((artist.totalGigsPerformed ?? 0) / 10, 10);
    score += experienceScore;

    return Math.min(Math.round(score), maxScore);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MATCH OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get all matches for a user
   */
  async getMatches(
    userId: string,
    role: UserRole,
    page = 1,
    limit = 20,
  ): Promise<{ matches: any[]; total: number; unreadCount: number }> {
    const skip = (page - 1) * limit;

    const query =
      role === UserRole.ARTIST
        ? { artistId: new Types.ObjectId(userId) }
        : { venueId: new Types.ObjectId(userId) };

    const [matches, total, unreadCount] = await Promise.all([
      this.matchModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('artistId', 'displayName stageName profilePhotoUrl genres')
        .populate('venueId', 'venueName profilePhotoUrl location')
        .lean(),
      this.matchModel.countDocuments(query),
      this.matchModel.countDocuments({
        ...query,
        lastMessageRead: false,
      }),
    ]);

    return {
      matches,
      total,
      unreadCount,
    };
  }

  /**
   * Get who liked/saved the user (for premium users)
   */
  async getWhoLikedMe(
    userId: string,
    role: UserRole,
    page = 1,
    limit = 20,
  ): Promise<{ profiles: any[]; total: number }> {
    const targetType = role === UserRole.ARTIST ? 'venue' : 'artist';

    const skip = (page - 1) * limit;

    const [profiles, total] = await Promise.all([
      this.swipeModel
        .find({
          userId: new Types.ObjectId(userId),
          targetType,
          swipeType: SwipeType.RIGHT,
          result: { $in: [SwipeResult.LIKED, SwipeResult.MATCH] },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.swipeModel.countDocuments({
        userId: new Types.ObjectId(userId),
        targetType,
        swipeType: SwipeType.RIGHT,
        result: { $in: [SwipeResult.LIKED, SwipeResult.MATCH] },
      }),
    ]);

    // Fetch full profile data for each swiper
    const profileIds = profiles.map((p) => p.targetId);
    const targetModel =
      role === UserRole.ARTIST ? this.venueModel : this.artistModel;

    const fullProfiles = await targetModel
      .find({ _id: { $in: profileIds } })
      .select('-email -phone')
      .lean();

    return {
      profiles: fullProfiles,
      total,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SWIPE HISTORY & ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get user's swipe history
   */
  async getSwipeHistory(
    userId: string,
    role: UserRole,
    query: SwipeQueryDto,
  ): Promise<{ swipes: any[]; total: number }> {
    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 20);
    const limit = query.limit ?? 20;

    const filter: any = { userId: new Types.ObjectId(userId) };

    if (query.swipeType) {
      filter.swipeType = query.swipeType;
    }
    if (query.result) {
      filter.result = query.result;
    }
    if (query.targetType) {
      filter.targetType = query.targetType;
    }

    const [swipes, total] = await Promise.all([
      this.swipeModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.swipeModel.countDocuments(filter),
    ]);

    return { swipes, total };
  }

  /**
   * Get swipe statistics for a user
   */
  async getSwipeStats(userId: string, role: UserRole): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStats, totalStats, recentMatches] = await Promise.all([
      // Today's activity
      this.swipeModel.aggregate([
        {
          $match: {
            userId: new Types.ObjectId(userId),
            createdAt: { $gte: today },
          },
        },
        {
          $group: {
            _id: null,
            totalSwipes: { $sum: 1 },
            rightSwipes: {
              $sum: { $cond: [{ $eq: ['$swipeType', SwipeType.RIGHT] }, 1, 0] },
            },
            leftSwipes: {
              $sum: { $cond: [{ $eq: ['$swipeType', SwipeType.LEFT] }, 1, 0] },
            },
            matches: {
              $sum: { $cond: [{ $eq: ['$result', SwipeResult.MATCH] }, 1, 0] },
            },
          },
        },
      ]),
      // All-time stats
      this.swipeModel.aggregate([
        {
          $match: { userId: new Types.ObjectId(userId) },
        },
        {
          $group: {
            _id: null,
            totalSwipes: { $sum: 1 },
            rightSwipes: {
              $sum: { $cond: [{ $eq: ['$swipeType', SwipeType.RIGHT] }, 1, 0] },
            },
            leftSwipes: {
              $sum: { $cond: [{ $eq: ['$swipeType', SwipeType.LEFT] }, 1, 0] },
            },
            matches: {
              $sum: { $cond: [{ $eq: ['$result', SwipeResult.MATCH] }, 1, 0] },
            },
            skipped: {
              $sum: {
                $cond: [{ $eq: ['$result', SwipeResult.SKIPPED] }, 1, 0],
              },
            },
          },
        },
      ]),
      // Recent matches count
      this.matchModel.countDocuments({
        $or: [
          { artistId: new Types.ObjectId(userId) },
          { venueId: new Types.ObjectId(userId) },
        ],
        createdAt: {
          $gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    const maxSwipes = this.maxSwipesPerDay[role] ?? 100;

    return {
      today: {
        ...(todayStats[0] || {
          totalSwipes: 0,
          rightSwipes: 0,
          leftSwipes: 0,
          matches: 0,
        }),
        remainingSwipes: maxSwipes - (todayStats[0]?.totalSwipes ?? 0),
        maxSwipes,
      },
      allTime: {
        ...(totalStats[0] || {
          totalSwipes: 0,
          rightSwipes: 0,
          leftSwipes: 0,
          matches: 0,
          skipped: 0,
        }),
      },
      recentMatches,
      matchRate: totalStats[0]?.totalSwipes
        ? ((totalStats[0].matches / totalStats[0].rightSwipes) * 100).toFixed(1)
        : '0',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Validate that the swipe target exists
   */
  private async validateSwipeTarget(
    role: UserRole,
    targetId: string,
  ): Promise<void> {
    if (role === UserRole.ARTIST) {
      const venue = await this.venueModel.findById(targetId);
      if (!venue) {
        throw new NotFoundException('Venue not found');
      }
      if (!venue.isProfileVisible || !venue.hasCompletedSetup) {
        throw new NotFoundException('Venue is not available for discovery');
      }
    } else {
      const artist = await this.artistModel.findById(targetId);
      if (!artist) {
        throw new NotFoundException('Artist not found');
      }
      if (!artist.isProfileVisible || !artist.hasCompletedSetup) {
        throw new NotFoundException('Artist is not available for discovery');
      }
    }
  }

  /**
   * Get target user's ID for match checking
   */
  private async getTargetUserId(
    role: UserRole,
    targetId: string,
  ): Promise<Types.ObjectId> {
    if (role === UserRole.ARTIST) {
      const venue = await this.venueModel.findById(targetId).select('userId');
      if (!venue) throw new NotFoundException('Venue not found');
      return venue.userId;
    } else {
      const artist = await this.artistModel.findById(targetId).select('userId');
      if (!artist) throw new NotFoundException('Artist not found');
      return artist.userId;
    }
  }

  /**
   * Check rate limiting for swipes
   */
  private async checkRateLimit(userId: string, role: UserRole): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const swipeCount = await this.swipeModel.countDocuments({
      userId: new Types.ObjectId(userId),
      createdAt: { $gte: today },
    });

    const maxSwipes = this.maxSwipesPerDay[role] ?? 100;
    if (swipeCount >= maxSwipes) {
      throw new ForbiddenException(
        `Daily swipe limit reached (${maxSwipes} swipes). Try again tomorrow.`,
      );
    }
  }

  /**
   * Check undo rate limiting
   */
  private async checkUndoRateLimit(userId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const undoCount = await this.swipeModel.countDocuments({
      userId: new Types.ObjectId(userId),
      createdAt: { $gte: today },
      metadata: { $exists: true },
    });

    if (undoCount >= this.maxUndoPerDay) {
      throw new ForbiddenException(
        `Daily undo limit reached (${this.maxUndoPerDay} undos). Try again tomorrow.`,
      );
    }
  }

  /**
   * Create a match record
   */
  private async createMatch(
    userId: string,
    targetUserId: string,
    role: UserRole,
    targetId: string,
    session: ClientSession,
  ): Promise<Match> {
    const matchData =
      role === UserRole.ARTIST
        ? {
            artistId: new Types.ObjectId(userId),
            venueId: new Types.ObjectId(targetId),
          }
        : {
            artistId: new Types.ObjectId(targetId),
            venueId: new Types.ObjectId(userId),
          };

    const [match] = await this.matchModel.create(
      [
        {
          ...matchData,
          status: 'active',
          lastMessageAt: new Date(),
        },
      ],
      { session },
    );

    return match;
  }

  /**
   * Increment daily swipe count (for rate limiting)
   */
  private async incrementSwipeCount(
    userId: string,
    role: UserRole,
  ): Promise<void> {
    // This is handled by the count query, no separate increment needed
    // The count is calculated on-demand for rate limiting
  }

  /**
   * Get IDs of gigs user has already swiped on
   */
  private async getSwipedGigIds(userId: string): Promise<Types.ObjectId[]> {
    const swipes = await this.swipeModel
      .find({
        userId: new Types.ObjectId(userId),
        targetType: 'gig',
      })
      .select('targetId')
      .lean();

    return swipes.map((s) => s.targetId as Types.ObjectId);
  }

  /**
   * Get IDs of profiles user has already swiped on
   */
  private async getSwipedProfileIds(userId: string): Promise<Types.ObjectId[]> {
    const swipes = await this.swipeModel
      .find({
        userId: new Types.ObjectId(userId),
        targetType: { $in: ['artist', 'venue'] },
      })
      .select('targetId')
      .lean();

    return swipes.map((s) => s.targetId as Types.ObjectId);
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
