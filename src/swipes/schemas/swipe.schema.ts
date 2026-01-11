/// 🔄 Swipe Schema - Discovery/Matching System
///
/// Stores all swipe actions for the Tinder-style discovery feature
/// Supports geospatial queries for location-based matching
/// Optimized for high-volume swipe operations

import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../auth/schemas/user.schema';

/// Direction of swipe action
export enum SwipeDirection {
  LEFT = 'left', // Skip/Pass
  RIGHT = 'right', // Like/Contact
}

/// Result of a swipe action
export enum SwipeResult {
  NO_MATCH = 'no_match', // Swipe left or no mutual interest
  LIKED = 'liked', // Liked but awaiting match
  MATCH = 'match', // Mutual right swipe
  PENDING = 'pending', // Awaiting other user's action
  EXPIRED = 'expired', // Match window expired
  CANCELED = 'canceled', // User canceled swipe
}

/// Source of the swipe action
export enum SwipeSource {
  DISCOVERY = 'discovery', // Main discovery feed
  SEARCH = 'search', // From search results
  RECOMMENDED = 'recommended', // From recommendations
  NEARBY = 'nearby', // From nearby users
  VENUE_BROWSE = 'venue_browse', // Venue browsing artists
  ARTIST_BROWSE = 'artist_browse', // Artist browsing venues
}

/// Main swipe schema
@Schema({
  timestamps: true,
  collection: 'swipes',
})
export class Swipe {
  /// User who performed the swipe
  @ApiProperty({ description: 'Swiper user ID' })
  @Prop({ type: Types.ObjectId, required: true, index: true })
  swiperId: Types.ObjectId;

  /// Role of the swiping user
  @ApiProperty({ enum: UserRole, description: 'Swiper role' })
  @Prop({ type: String, enum: Object.values(UserRole), required: true })
  swiperRole: UserRole;

  /// Target user being swiped on
  @ApiProperty({ description: 'Target user ID' })
  @Prop({ type: Types.ObjectId, required: true, index: true })
  targetId: Types.ObjectId;

  /// Role of the target user
  @ApiProperty({ enum: UserRole, description: 'Target role' })
  @Prop({ type: String, enum: Object.values(UserRole), required: true })
  targetRole: UserRole;

  /// Direction of swipe
  @ApiProperty({ enum: SwipeDirection, description: 'Swipe direction' })
  @Prop({
    type: String,
    enum: Object.values(SwipeDirection),
    required: true,
    index: true,
  })
  direction: SwipeDirection;

  /// Result of the swipe
  @ApiProperty({ enum: SwipeResult, description: 'Swipe result' })
  @Prop({
    type: String,
    enum: Object.values(SwipeResult),
    default: SwipeResult.PENDING,
  })
  result: SwipeResult;

  /// Source of the swipe
  @ApiProperty({ enum: SwipeSource, description: 'Swipe source' })
  @Prop({
    type: String,
    enum: Object.values(SwipeSource),
    default: SwipeSource.DISCOVERY,
  })
  source: SwipeSource;

  /// Related gig ID (if swiping on a specific gig)
  @ApiPropertyOptional({ description: 'Related gig ID' })
  @Prop({ type: Types.ObjectId, index: true, sparse: true })
  relatedGigId?: Types.ObjectId;

  /// Genre tag associated with the swipe
  @ApiPropertyOptional({ description: 'Genre tag' })
  @Prop({ type: String, index: true })
  genre?: string;

  /// Distance in kilometers (calculated at swipe time)
  @ApiPropertyOptional({ description: 'Distance in km' })
  @Prop({ type: Number, min: 0 })
  distanceKm?: number;

  /// Location of the target at swipe time
  @ApiPropertyOptional({ description: 'Target location' })
  @Prop({
    type: raw({
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    }),
    index: '2dsphere',
  })
  targetLocation?: {
    type: string;
    coordinates: [number, number];
  };

  /// User's location at swipe time
  @ApiPropertyOptional({ description: 'Swiper location' })
  @Prop({
    type: raw({
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    }),
  })
  swiperLocation?: {
    type: string;
    coordinates: [number, number];
  };

  /// Recommendation score that influenced this swipe (0-100)
  @ApiPropertyOptional({
    description: 'Recommendation score',
    minimum: 0,
    maximum: 100,
  })
  @Prop({ type: Number, min: 0, max: 100 })
  recommendationScore?: number;

  /// Whether this swipe has been processed
  @ApiProperty({ description: 'Whether swipe is processed' })
  @Prop({ type: Boolean, default: false })
  isProcessed: boolean;

  /// When the swipe was processed
  @ApiPropertyOptional({ description: 'Processing timestamp' })
  @Prop({ type: Date })
  processedAt?: Date;

  /// Whether the swipe has been undone
  @ApiProperty({ description: 'Whether swipe is undone' })
  @Prop({ type: Boolean, default: false })
  isUndone: boolean;

  /// When the swipe was undone
  @ApiPropertyOptional({ description: 'Undo timestamp' })
  @Prop({ type: Date })
  undoneAt?: Date;

  /// IP address for fraud prevention
  @ApiPropertyOptional({ description: 'IP address' })
  @Prop({ type: String })
  ipAddress?: string;

  /// User agent for analytics
  @ApiPropertyOptional({ description: 'User agent string' })
  @Prop({ type: String })
  userAgent?: string;

  /// Session ID for grouping related swipes
  @ApiPropertyOptional({ description: 'Session ID for swipe session' })
  @Prop({ type: String, index: true })
  sessionId?: string;

  /// Additional metadata
  @ApiPropertyOptional({ description: 'Additional metadata' })
  @Prop({ type: Map, of: SchemaFactory.createForClass(Object) })
  metadata?: Map<string, any>;
}

export type SwipeDocument = Swipe & Document;
export const SwipeSchema = SchemaFactory.createForClass(Swipe);

// Compound indexes for efficient queries
SwipeSchema.index({ swiperId: 1, targetId: 1 }, { unique: true });
SwipeSchema.index({ swiperId: 1, createdAt: -1 });
SwipeSchema.index({ targetId: 1, direction: 1, createdAt: -1 });
SwipeSchema.index({ result: 1, createdAt: -1 });
SwipeSchema.index({ swiperId: 1, result: 1 });
SwipeSchema.index({ swiperId: 1, sessionId: 1, createdAt: -1 });
SwipeSchema.index({ swiperRole: 1, targetRole: 1, result: 1 });

// Geospatial index for location-based queries
SwipeSchema.index({ 'targetLocation.coordinates': '2dsphere' });
SwipeSchema.index({ 'swiperLocation.coordinates': '2dsphere' });

// TTL index for automatic cleanup after 2 years
SwipeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

// Static methods for common queries
SwipeSchema.statics.findBySwiper = function (
  swiperId: Types.ObjectId,
  limit = 50,
) {
  return this.find({ swiperId }).sort({ createdAt: -1 }).limit(limit).exec();
};

SwipeSchema.statics.findByTarget = function (
  targetId: Types.ObjectId,
  limit = 50,
) {
  return this.find({ targetId }).sort({ createdAt: -1 }).limit(limit).exec();
};

SwipeSchema.statics.findExistingSwipe = function (
  swiperId: Types.ObjectId,
  targetId: Types.ObjectId,
) {
  return this.findOne({ swiperId, targetId }).exec();
};

SwipeSchema.statics.getMatchCandidates = function (
  targetId: Types.ObjectId,
  direction: SwipeDirection,
  processed: boolean = false,
) {
  return this.find({
    targetId,
    direction,
    isProcessed: processed,
    isUndone: false,
  }).exec();
};

SwipeSchema.statics.getSwipeStats = function (swiperId: Types.ObjectId) {
  return this.aggregate([
    { $match: { swiperId: swiperId, isUndone: false } },
    {
      $group: {
        _id: '$direction',
        count: { $sum: 1 },
        matches: {
          $sum: {
            $cond: [{ $eq: ['$result', 'match'] }, 1, 0],
          },
        },
      },
    },
  ]).exec();
};

SwipeSchema.statics.getRecentSwipeSession = function (
  swiperId: Types.ObjectId,
) {
  return this.findOne({ swiperId })
    .sort({ createdAt: -1 })
    .select('sessionId createdAt')
    .exec();
};

SwipeSchema.statics.countSwipesToday = async function (
  swiperId: Types.ObjectId,
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return this.countDocuments({
    swiperId,
    createdAt: { $gte: startOfDay },
    isUndone: false,
  });
};

// Pre-save hook for setting default location
SwipeSchema.pre('save', function (next: any) {
  if (this.targetLocation && this.targetLocation.coordinates) {
    // Ensure coordinates are in [lng, lat] format for MongoDB
    if (
      Array.isArray(this.targetLocation.coordinates) &&
      this.targetLocation.coordinates.length === 2
    ) {
      // Swap if needed to ensure [lng, lat] format
      const [lat, lng] = this.targetLocation.coordinates;
      this.targetLocation.coordinates = [lng, lat];
    }
  }
  next();
});


