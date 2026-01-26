/// 📊 GigMatch Analytics Service - Backend Implementation
///
/// Comprehensive analytics service for tracking user engagement and platform metrics
/// Features:
/// - Profile views tracking and analytics
/// - Discovery/swipe metrics
/// - Engagement and messaging analytics
/// - Gig and booking statistics
/// - Earnings tracking for artists
/// - Real-time analytics updates
/// - Data aggregation and reporting

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../schemas/user.schema';
import { Artist, ArtistDocument } from '../artists/schemas/artist.schema';
import { Venue, VenueDocument } from '../venues/schemas/venue.schema';
import { Swipe, SwipeDocument } from '../schemas/swipe.schema';
import { Match, MatchDocument } from '../schemas/match.schema';
import { Message, MessageDocument } from '../schemas/message.schema';
import { Booking, BookingDocument } from '../schemas/booking.schema';
import { Gig, GigDocument } from '../schemas/gig.schema';
import { Review, ReviewDocument } from '../schemas/review.schema';
import {
  AnalyticsEvent,
  AnalyticsEventDocument,
} from './schemas/analytics-event.schema';

interface DateRange {
  start: Date;
  end: Date;
}

interface TopViewer {
  userId: string;
  userName: string;
  userPhoto?: string;
  userType: string;
  viewCount: number;
  lastViewed?: Date;
}

interface SwipeSession {
  startedAt: Date;
  endedAt?: Date;
  swipesRight: number;
  swipesLeft: number;
  matches: number;
  durationSeconds: number;
}

interface RecentGig {
  gigId: string;
  gigTitle: string;
  venueName: string;
  amount: number;
  date: Date;
  status: string;
  rating?: number;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  requestedAt: Date;
  processedAt?: Date;
  paidAt?: Date;
}

interface ProfileViewAnalytics {
  totalViews: number;
  uniqueViewers: number;
  viewsByDay: Record<string, number>;
  viewsBySource: Record<string, number>;
  avgTimeOnProfile: number;
  topViewers: TopViewer[];
}

interface DiscoveryAnalytics {
  totalSwipesRight: number;
  totalSwipesLeft: number;
  matchesReceived: number;
  matchesMade: number;
  matchRate: number;
  swipesByGenre: Record<string, number>;
  matchesByGenre: Record<string, number>;
  boostCount: number;
  lastSwipeAt?: Date;
  recentSessions: SwipeSession[];
}

interface EngagementAnalytics {
  totalMessagesSent: number;
  totalMessagesReceived: number;
  totalConversations: number;
  avgResponseTimeMinutes: number;
  totalBookings: number;
  completedBookings: number;
  canceledBookings: number;
  reviewsGiven: number;
  reviewsReceived: number;
  avgRatingGiven: number;
  avgRatingReceived: number;
  activityByDay: Record<string, number>;
  activeDays: number;
}

interface GigAnalytics {
  gigsApplied: number;
  gigsBooked: number;
  gigsCompleted: number;
  gigsCanceled: number;
  bookingRate: number;
  completionRate: number;
  avgEarningsPerGig: number;
  totalEarnings: number;
  earningsByMonth: Record<string, number>;
  gigsByVenueType: Record<string, number>;
  recentGigs: RecentGig[];
}

interface EarningsSummary {
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  avgPerGig: number;
  totalGigs: number;
  earningsByMonth: Record<string, number>;
  earningsByVenue: Record<string, number>;
  recentPayouts: Payout[];
}

interface AnalyticsOverview {
  profileViews?: ProfileViewAnalytics;
  discovery?: DiscoveryAnalytics;
  engagement?: EngagementAnalytics;
  gigs?: GigAnalytics;
  earnings?: EarningsSummary;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Artist.name) private artistModel: Model<ArtistDocument>,
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
    @InjectModel(Swipe.name) private swipeModel: Model<SwipeDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Gig.name) private gigModel: Model<GigDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(AnalyticsEvent.name)
    private analyticsEventModel: Model<AnalyticsEventDocument>,
    private configService: ConfigService,
  ) {}

  /// Get analytics overview for a user
  async getOverview(
    userId: string,
    userType: string,
    period: string = 'month',
  ): Promise<AnalyticsOverview> {
    const dateRange = this.getDateRange(period);

    const [profileViews, discovery, engagement, gigs, earnings] =
      await Promise.all([
        this.getProfileViews(userId, dateRange),
        this.getDiscoveryAnalytics(userId, userType, dateRange),
        this.getEngagementAnalytics(userId, userType, dateRange),
        this.getGigAnalytics(userId, dateRange),
        userType === 'artist'
          ? this.getEarningsSummary(userId, dateRange)
          : null,
      ]);

    return {
      profileViews,
      discovery,
      engagement,
      gigs,
      earnings: earnings || undefined,
      periodStart: dateRange.start,
      periodEnd: dateRange.end,
      periodLabel: this.getPeriodLabel(period),
    };
  }

  /// Get profile view analytics
  async getProfileViews(
    userId: string,
    dateRange: DateRange,
  ): Promise<ProfileViewAnalytics> {
    // Get all profile views in the date range
    const viewEvents = await this.analyticsEventModel
      .find({
        eventType: 'profile_view',
        'data.targetUserId': userId,
        timestamp: { $gte: dateRange.start, $lte: dateRange.end },
      })
      .sort({ timestamp: -1 })
      .exec();

    const totalViews = viewEvents.length;

    // Get unique viewers
    const uniqueViewerIds = new Set<string>();
    const viewerCounts: Record<string, { count: number; lastViewed?: Date }> =
      {};

    for (const event of viewEvents) {
      const viewerId = event.data.viewerId as string;
      uniqueViewerIds.add(viewerId);

      if (!viewerCounts[viewerId]) {
        viewerCounts[viewerId] = { count: 0 };
      }
      viewerCounts[viewerId].count++;
      viewerCounts[viewerId].lastViewed = event.timestamp;
    }

    // Get top viewers with user details
    const topViewers: TopViewer[] = [];
    const sortedViewers = Object.entries(viewerCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    for (const [viewerId, data] of sortedViewers) {
      const user = await this.userModel.findById(viewerId).exec();
      if (user) {
        const viewerUserType = user.role;
        let viewerName = '';
        let viewerPhoto: string | undefined;

        if (viewerUserType === 'artist') {
          const artistUser = await this.userModel
            .findOne({ _id: viewerId, role: 'artist' })
            .exec();
          const artistId = (artistUser as any)?.artistId;
          const artist = artistId
            ? await this.artistModel.findById(artistId).exec()
            : null;
          if (artist) {
            viewerName = artist.displayName || 'Unknown Artist';
            viewerPhoto = artist.profilePhotoUrl;
          }
        } else if (viewerUserType === 'venue') {
          const venueUser = await this.userModel
            .findOne({ _id: viewerId, role: 'venue' })
            .exec();
          const venueId = (venueUser as any)?.venueId;
          const venue = venueId
            ? await this.venueModel.findById(venueId).exec()
            : null;
          if (venue) {
            viewerName = venue.venueName || 'Unknown Venue';
            viewerPhoto = venue.photos?.[0]?.url;
          }
        }

        topViewers.push({
          userId: viewerId,
          userName: viewerName || user.fullName || 'Unknown',
          userPhoto: viewerPhoto,
          userType: viewerUserType,
          viewCount: data.count,
          lastViewed: data.lastViewed,
        });
      }
    }

    // Group views by day
    const viewsByDay: Record<string, number> = {};
    for (const event of viewEvents) {
      const dayKey = event.timestamp.toISOString().split('T')[0];
      viewsByDay[dayKey] = (viewsByDay[dayKey] || 0) + 1;
    }

    // Group views by source
    const viewsBySource: Record<string, number> = {};
    for (const event of viewEvents) {
      const source = (event.data.source as string) || 'unknown';
      viewsBySource[source] = (viewsBySource[source] || 0) + 1;
    }

    return {
      totalViews,
      uniqueViewers: uniqueViewerIds.size,
      viewsByDay,
      viewsBySource,
      avgTimeOnProfile: 45, // Would calculate from actual engagement data
      topViewers,
    };
  }

  /// Track a profile view
  async trackProfileView(
    viewerId: string,
    viewerType: string,
    targetUserId: string,
    source: string = 'discovery',
  ): Promise<void> {
    const event = new this.analyticsEventModel({
      eventType: 'profile_view',
      userId: viewerId,
      userType: viewerType,
      data: {
        viewerId,
        viewerType,
        targetUserId,
        source,
      },
      timestamp: new Date(),
    });

    await event.save();
  }

  /// Get discovery/swipe analytics
  async getDiscoveryAnalytics(
    userId: string,
    userType: string,
    dateRange: DateRange,
  ): Promise<DiscoveryAnalytics> {
    const userIdObj = new Types.ObjectId(userId);

    // Get swipe counts
    const swipesRight = await this.swipeModel.countDocuments({
      swiperId: userIdObj,
      direction: 'right',
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    const swipesLeft = await this.swipeModel.countDocuments({
      swiperId: userIdObj,
      direction: 'left',
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    // Get matches
    const matchField = userType === 'artist' ? 'artistUser' : 'venueUser';
    const matchesReceived = await this.matchModel.countDocuments({
      [matchField]: userIdObj,
      status: 'active',
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    const matchesMadeField = userType === 'artist' ? 'venueUser' : 'artistUser';
    const matchesMade = await this.matchModel.countDocuments({
      [matchesMadeField]: userIdObj,
      status: 'active',
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    // Calculate match rate
    const totalSwipes = swipesRight + swipesLeft;
    const matchRate = totalSwipes > 0 ? (matchesMade / totalSwipes) * 100 : 0;

    // Get last swipe time
    const lastSwipe = await this.swipeModel
      .findOne({ swiperId: userIdObj })
      .sort({ createdAt: -1 })
      .exec();

    // Group swipes by genre
    const swipesByGenre: Record<string, number> = {};
    const swipes = await this.swipeModel
      .find({
        swiperId: userIdObj,
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      })
      .exec();

    for (const swipe of swipes) {
      const genre = (swipe as any).targetGenre || 'unknown';
      swipesByGenre[genre] = (swipesByGenre[genre] || 0) + 1;
    }

    // Group matches by genre
    const matchesByGenre: Record<string, number> = {};
    const userMatches = await this.matchModel
      .find({
        $or: [{ artistUser: userIdObj }, { venueUser: userIdObj }],
        status: 'active',
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      })
      .exec();

    for (const match of userMatches) {
      const genre = (match as any).genre || 'unknown';
      matchesByGenre[genre] = (matchesByGenre[genre] || 0) + 1;
    }

    // Get boost count (would track separately)
    const boostCount = 0;

    return {
      totalSwipesRight: swipesRight,
      totalSwipesLeft: swipesLeft,
      matchesReceived,
      matchesMade,
      matchRate,
      swipesByGenre,
      matchesByGenre,
      boostCount,
      lastSwipeAt: (lastSwipe as any)?.createdAt || new Date(),
      recentSessions: [],
    };
  }

  /// Track a swipe action
  async trackSwipe(
    userId: string,
    userType: string,
    targetUserId: string,
    targetUserType: string,
    isRightSwipe: boolean,
    genre?: string,
  ): Promise<void> {
    const event = new this.analyticsEventModel({
      eventType: isRightSwipe ? 'swipe_right' : 'swipe_left',
      userId,
      userType,
      data: {
        targetUserId,
        targetUserType,
        isRightSwipe,
        genre,
      },
      timestamp: new Date(),
    });

    await event.save();
  }

  /// Get engagement analytics
  async getEngagementAnalytics(
    userId: string,
    userType: string,
    dateRange: DateRange,
  ): Promise<EngagementAnalytics> {
    const userIdObj = new Types.ObjectId(userId);

    // Get message counts
    const messagesSent = await this.messageModel.countDocuments({
      sender: userIdObj,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    // Get conversations
    const conversations = await this.matchModel
      .find({
        $or: [{ artistUser: userIdObj }, { venueUser: userIdObj }],
        status: 'active',
      })
      .exec();

    const totalConversations = conversations.length;

    // Get bookings
    const bookingsField = userType === 'artist' ? 'artistUser' : 'venueUser';
    const totalBookings = await this.bookingModel.countDocuments({
      [bookingsField]: userIdObj,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    const completedBookings = await this.bookingModel.countDocuments({
      [bookingsField]: userIdObj,
      status: 'completed',
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    const canceledBookings = await this.bookingModel.countDocuments({
      [bookingsField]: userIdObj,
      status: 'canceled',
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    // Get reviews
    const reviewsGiven = await this.reviewModel.countDocuments({
      reviewer: userIdObj,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    const reviewsReceived = await this.reviewModel.countDocuments({
      reviewee: userIdObj,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    // Get average ratings
    const avgRatingGiven = await this.calculateAverageRating(
      userIdObj,
      'reviewer',
    );
    const avgRatingReceived = await this.calculateAverageRating(
      userIdObj,
      'reviewee',
    );

    // Group activity by day
    const activityByDay: Record<string, number> = {};
    const activities = await this.analyticsEventModel
      .find({
        userId: userIdObj,
        timestamp: { $gte: dateRange.start, $lte: dateRange.end },
      })
      .exec();

    for (const activity of activities) {
      const dayKey = activity.timestamp.toISOString().split('T')[0];
      activityByDay[dayKey] = (activityByDay[dayKey] || 0) + 1;
    }

    // Calculate active days
    const activeDays = Object.keys(activityByDay).length;

    return {
      totalMessagesSent: messagesSent,
      totalMessagesReceived: 0, // Would need reverse lookup
      totalConversations,
      avgResponseTimeMinutes: 30, // Would calculate from message timestamps
      totalBookings,
      completedBookings,
      canceledBookings,
      reviewsGiven,
      reviewsReceived,
      avgRatingGiven,
      avgRatingReceived,
      activityByDay,
      activeDays,
    };
  }

  /// Track a message sent
  async trackMessageSent(
    senderId: string,
    conversationId: string,
    recipientId: string,
    hasMedia: boolean,
  ): Promise<void> {
    const event = new this.analyticsEventModel({
      eventType: 'message_sent',
      userId: senderId,
      userType: 'user',
      data: {
        conversationId,
        recipientId,
        hasMedia,
      },
      timestamp: new Date(),
    });

    await event.save();
  }

  /// Get gig analytics (for artists)
  async getGigAnalytics(
    artistId: string,
    dateRange: DateRange,
  ): Promise<GigAnalytics> {
    const artistIdObj = new Types.ObjectId(artistId);

    // Get gig applications
    const gigsApplied = await this.gigModel.countDocuments({
      'applications.artistId': artistIdObj,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    // Get bookings
    const gigsBooked = await this.bookingModel.countDocuments({
      artistUser: artistIdObj,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    const gigsCompleted = await this.bookingModel.countDocuments({
      artistUser: artistIdObj,
      status: 'completed',
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    const gigsCanceled = await this.bookingModel.countDocuments({
      artistUser: artistIdObj,
      status: 'canceled',
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    });

    // Calculate rates
    const bookingRate = gigsApplied > 0 ? (gigsBooked / gigsApplied) * 100 : 0;
    const completionRate =
      gigsBooked > 0 ? (gigsCompleted / gigsBooked) * 100 : 0;

    // Get earnings
    const completedBookings = await this.bookingModel
      .find({
        artistUser: artistIdObj,
        status: 'completed',
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      })
      .exec();

    const totalEarnings = completedBookings.reduce(
      (sum, booking) => sum + ((booking as any).finalAmount || 0),
      0,
    );
    const avgEarningsPerGig =
      completedBookings.length > 0
        ? totalEarnings / completedBookings.length
        : 0;

    // Get monthly earnings breakdown
    const earningsByMonth: Record<string, number> = {};
    for (const booking of completedBookings) {
      const createdAt = (booking as any).createdAt || new Date();
      const monthKey = createdAt.toISOString().slice(0, 7);
      earningsByMonth[monthKey] =
        (earningsByMonth[monthKey] || 0) + ((booking as any).finalAmount || 0);
    }

    // Group gigs by venue type
    const gigsByVenueType: Record<string, number> = {};
    const venueGigs = await this.bookingModel
      .find({
        artistUser: artistIdObj,
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      })
      .populate('gig')
      .exec();

    for (const booking of venueGigs) {
      if (booking.gig) {
        const gig = booking.gig as any;
        const venue = await this.venueModel.findById(gig.venue).exec();
        if (venue) {
          const venueType = venue.venueType || 'Other';
          gigsByVenueType[venueType] = (gigsByVenueType[venueType] || 0) + 1;
        }
      }
    }

    // Get recent gigs
    const recentGigs: RecentGig[] = [];
    const recentBookings = await this.bookingModel
      .find({
        artistUser: artistIdObj,
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('gig')
      .exec();

    for (const booking of recentBookings) {
      const gig = booking.gig as any;
      if (gig) {
        const createdAt = (booking as any).createdAt || new Date();
        recentGigs.push({
          gigId: gig._id.toString(),
          gigTitle: gig.title || 'Gig',
          venueName: gig.venueName || 'Unknown Venue',
          amount: (booking as any).finalAmount || 0,
          date: createdAt,
          status: booking.status,
        });
      }
    }

    return {
      gigsApplied,
      gigsBooked,
      gigsCompleted,
      gigsCanceled,
      bookingRate,
      completionRate,
      avgEarningsPerGig,
      totalEarnings,
      earningsByMonth,
      gigsByVenueType,
      recentGigs,
    };
  }

  /// Get earnings summary (for artists)
  async getEarningsSummary(
    artistId: string,
    dateRange: DateRange,
  ): Promise<EarningsSummary> {
    const artistIdObj = new Types.ObjectId(artistId);

    // Get all completed bookings
    const completedBookings = await this.bookingModel
      .find({
        artistUser: artistIdObj,
        status: 'completed',
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      })
      .exec();

    const totalEarnings = completedBookings.reduce(
      (sum, booking) => sum + ((booking as any).finalAmount || 0),
      0,
    );

    // Calculate pending and paid earnings
    const pendingBookings = await this.bookingModel
      .find({
        artistUser: artistIdObj,
        status: { $in: ['pending', 'confirmed'] },
        gigDate: { $gte: new Date() },
      })
      .exec();

    const pendingEarnings = pendingBookings.reduce(
      (sum, booking) => sum + ((booking as any).finalAmount || 0),
      0,
    );

    const paidEarnings = 0; // Would track payouts separately

    const totalGigs = completedBookings.length;
    const avgPerGig = totalGigs > 0 ? totalEarnings / totalGigs : 0;

    // Group earnings by month
    const earningsByMonth: Record<string, number> = {};
    for (const booking of completedBookings) {
      const createdAt = (booking as any).createdAt || new Date();
      const monthKey = createdAt.toISOString().slice(0, 7);
      earningsByMonth[monthKey] =
        (earningsByMonth[monthKey] || 0) + ((booking as any).finalAmount || 0);
    }

    // Group earnings by venue
    const earningsByVenue: Record<string, number> = {};

    return {
      totalEarnings,
      pendingEarnings,
      paidEarnings,
      avgPerGig,
      totalGigs,
      earningsByMonth,
      earningsByVenue,
      recentPayouts: [],
    };
  }

  /// Track event
  async trackEvent(
    eventType: string,
    userId: string,
    userType: string,
    data: Record<string, any>,
  ): Promise<void> {
    const event = new this.analyticsEventModel({
      eventType,
      userId,
      userType,
      data,
      timestamp: new Date(),
    });

    await event.save();
  }

  /// Export analytics data
  async exportAnalytics(
    userId: string,
    userType: string,
    period: string,
    format: string,
  ): Promise<{ downloadUrl: string }> {
    const overview = await this.getOverview(userId, userType, period);

    // In production, generate file and upload to cloud storage
    return {
      downloadUrl: `/api/v1/analytics/download/${userId}-${period}.${format}`,
    };
  }

  /// Generate analytics report
  async generateReport(
    userId: string,
    userType: string,
    period: string,
    sections?: string[],
  ): Promise<{ reportUrl: string }> {
    // In production, generate PDF report
    return {
      reportUrl: `/api/v1/analytics/reports/${userId}-${Date.now()}.pdf`,
    };
  }

  /// Get date range from period string
  private getDateRange(period: string): DateRange {
    const end = new Date();
    let start: Date;

    switch (period) {
      case 'today':
        start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        break;
      case 'week':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        start = new Date(0);
        break;
      default:
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  /// Get period label
  private getPeriodLabel(period: string): string {
    switch (period) {
      case 'today':
        return 'Today';
      case 'week':
        return 'Last 7 days';
      case 'month':
        return 'Last 30 days';
      case 'quarter':
        return 'Last 90 days';
      case 'year':
        return 'Last year';
      case 'all':
        return 'All time';
      default:
        return 'Last 30 days';
    }
  }

  /// Calculate average rating
  private async calculateAverageRating(
    userId: Types.ObjectId,
    field: 'reviewer' | 'reviewee',
  ): Promise<number> {
    const result = await this.reviewModel
      .aggregate([
        { $match: { [field]: userId } },
        { $group: { _id: null, avg: { $avg: '$rating' } } },
      ])
      .exec();

    return result.length > 0 ? result[0].avg : 0;
  }

  /// Get platform-wide analytics (for admin)
  async getPlatformAnalytics(dateRange: DateRange): Promise<any> {
    const [
      totalUsers,
      activeUsers,
      totalArtists,
      totalVenues,
      totalMatches,
      totalMessages,
      totalBookings,
      totalGigs,
    ] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.userModel
        .countDocuments({ lastActiveAt: { $gte: dateRange.start } })
        .exec(),
      this.artistModel.countDocuments().exec(),
      this.venueModel.countDocuments().exec(),
      this.matchModel.countDocuments({
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      }),
      this.messageModel.countDocuments({
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      }),
      this.bookingModel.countDocuments({
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      }),
      this.gigModel.countDocuments({
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalArtists,
      totalVenues,
      totalMatches,
      totalMessages,
      totalBookings,
      totalGigs,
      periodStart: dateRange.start,
      periodEnd: dateRange.end,
    };
  }
}
