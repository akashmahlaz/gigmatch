/// 📊 Analytics Event Schema - Event Tracking & Analytics
///
/// Stores analytics events for tracking user behavior and platform metrics
/// Supports event-based analytics for dashboard and reporting

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../auth/schemas/user.schema';

/// Event types for analytics tracking
export enum AnalyticsEventType {
  // User Events
  USER_SIGNUP = 'user_signup',
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  PROFILE_VIEW = 'profile_view',
  PROFILE_EDIT = 'profile_edit',

  // Discovery & Swiping
  SWIPE_LEFT = 'swipe_left',
  SWIPE_RIGHT = 'swipe_right',
  MATCH_CREATED = 'match_created',
  UNDO_SWIPE = 'undo_swipe',

  // Messaging
  MESSAGE_SENT = 'message_sent',
  MESSAGE_RECEIVED = 'message_received',
  CONVERSATION_STARTED = 'conversation_started',

  // Gigs & Booking
  GIG_VIEWED = 'gig_viewed',
  GIG_APPLIED = 'gig_applied',
  BOOKING_CREATED = 'booking_created',
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_COMPLETED = 'booking_completed',
  BOOKING_CANCELED = 'booking_canceled',

  // Payment & Subscription
  PAYMENT_MADE = 'payment_made',
  SUBSCRIPTION_STARTED = 'subscription_started',
  SUBSCRIPTION_RENEWED = 'subscription_renewed',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',

  // App Features
  SEARCH_PERFORMED = 'search_performed',
  FILTER_APPLIED = 'filter_applied',
  DISCOVERY_FEED_VIEWED = 'discovery_feed_viewed',

  // Push Notifications
  NOTIFICATION_SENT = 'notification_sent',
  NOTIFICATION_OPENED = 'notification_opened',

  // Error Events
  ERROR_OCCURRED = 'error_occurred',
  API_CALL_FAILED = 'api_call_failed',
}

/// Analytics event schema
@Schema({
  timestamps: true,
  collection: 'analytics_events',
  // Keep events for 1 year for analytics
  // TTL index will be set in the schema definition below
})
export class AnalyticsEvent {
  /// Event type
  @ApiProperty({ enum: AnalyticsEventType })
  @Prop({
    type: String,
    enum: Object.values(AnalyticsEventType),
    required: true,
    index: true,
  })
  eventType: AnalyticsEventType;

  /// User who performed the event (optional for anonymous events)
  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', index: true, sparse: true })
  userId?: Types.ObjectId;

  /// User role at time of event
  @ApiProperty({ enum: UserRole })
  @Prop({
    type: String,
    enum: Object.values(UserRole),
    index: true,
  })
  userRole?: UserRole;

  /// Session ID for grouping related events
  @ApiProperty()
  @Prop({ type: String, index: true })
  sessionId?: string;

  /// Event data (flexible object for event-specific data)
  @ApiProperty()
  @Prop({ type: Object, default: {} })
  data: Record<string, any>;

  /// User agent string
  @ApiProperty()
  @Prop({ type: String })
  userAgent?: string;

  /// IP address
  @ApiProperty()
  @Prop({ type: String, index: true })
  ipAddress?: string;

  /// Referrer URL
  @ApiProperty()
  @Prop({ type: String })
  referrer?: string;

  /// Page or screen where event occurred
  @ApiProperty()
  @Prop({ type: String })
  page?: string;

  /// Timestamp when event was recorded
  @ApiProperty()
  @Prop({ type: Date, default: Date.now, index: true })
  timestamp: Date;

  /// Duration of the event in milliseconds (for duration-based events)
  @ApiProperty()
  @Prop({ type: Number, min: 0 })
  duration?: number;

  /// Success status of the event
  @ApiProperty()
  @Prop({ type: Boolean, default: true })
  success: boolean;

  /// Error message if event failed
  @ApiProperty()
  @Prop({ type: String })
  errorMessage?: string;

  /// Additional metadata
  @ApiProperty()
  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export type AnalyticsEventDocument = AnalyticsEvent & Document;
export const AnalyticsEventSchema = SchemaFactory.createForClass(AnalyticsEvent);

// Indexes for efficient querying
AnalyticsEventSchema.index({ eventType: 1, timestamp: -1 });
AnalyticsEventSchema.index({ userId: 1, timestamp: -1 });
AnalyticsEventSchema.index({ sessionId: 1, timestamp: -1 });
AnalyticsEventSchema.index({ userRole: 1, timestamp: -1 });
AnalyticsEventSchema.index({ timestamp: -1 });

// TTL index to automatically delete events after 1 year (365 days)
AnalyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

// Static methods for common queries
AnalyticsEventSchema.statics.recordEvent = function(
  eventType: AnalyticsEventType,
  userId?: string,
  data: Record<string, any> = {},
  sessionId?: string,
  userRole?: UserRole,
) {
  return this.create({
    eventType,
    userId,
    data,
    sessionId,
    userRole,
    timestamp: new Date(),
  });
};

AnalyticsEventSchema.statics.getEventsByUser = function(
  userId: Types.ObjectId,
  eventType?: AnalyticsEventType,
  limit = 100,
) {
  const filter: any = { userId };
  if (eventType) {
    filter.eventType = eventType;
  }

  return this.find(filter)
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
};

AnalyticsEventSchema.statics.getEventStats = function(
  startDate: Date,
  endDate: Date,
  eventType?: AnalyticsEventType,
) {
  const match: any = {
    timestamp: { $gte: startDate, $lte: endDate },
  };

  if (eventType) {
    match.eventType = eventType;
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        successRate: {
          $avg: { $cond: ['$success', 1, 0] },
        },
      },
    },
    {
      $project: {
        eventType: '$_id',
        count: 1,
        uniqueUserCount: { $size: '$uniqueUsers' },
        successRate: { $multiply: ['$successRate', 100] },
        _id: 0,
      },
    },
    { $sort: { count: -1 } },
  ]);
};

AnalyticsEventSchema.statics.getUserActivity = function(
  userId: Types.ObjectId,
  days = 30,
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    { $match: { userId, timestamp: { $gte: startDate } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
        },
        events: { $sum: 1 },
        uniqueSessions: { $addToSet: '$sessionId' },
        eventTypes: { $addToSet: '$eventType' },
      },
    },
    {
      $project: {
        date: '$_id',
        eventCount: 1,
        sessionCount: { $size: '$uniqueSessions' },
        eventTypeCount: { $size: '$eventTypes' },
        _id: 0,
      },
    },
    { $sort: { date: 1 } },
  ]);
};

// Instance method to check if event is successful
AnalyticsEventSchema.methods.isSuccessful = function(): boolean {
  return this.success === true;
};

// Instance method to get event duration
AnalyticsEventSchema.methods.getDuration = function(): number {
  return this.duration || 0;
};

// Instance method to add metadata
AnalyticsEventSchema.methods.addMetadata = function(
  key: string,
  value: any,
): void {
  if (!this.metadata) {
    this.metadata = {};
  }
  this.metadata[key] = value;
};
