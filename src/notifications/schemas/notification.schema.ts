/// 🔔 Notification Schema
/// Stores in-app notifications for users

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Notification types - must match what services send
 * Note: Using string values that match service calls
 */
export enum NotificationType {
  MATCH = 'match',
  MESSAGE = 'message',
  CHAT = 'chat',
  GIG_REMINDER = 'gig_reminder',
  GIG_OPPORTUNITY = 'gig_opportunity',
  GIG_CANCELLED = 'gig_cancelled',
  GIG_CONFIRMATION = 'gig_confirmation', // Application accepted notification
  BOOKING_CONFIRMATION = 'booking_confirmation', // Used by booking & gig services
  BOOKING_CONFIRMED = 'booking_confirmed', // Legacy/alternative
  BOOKING_CANCELLED = 'booking_cancelled',
  BOOKING_DECLINED = 'booking_declined', // When artist declines a booking offer
  REVIEW_RECEIVED = 'review_received',
  PAYMENT_RECEIVED = 'payment_received',
  PROFILE_VIEW = 'profile_view',
  BOOST = 'boost',
  SYSTEM = 'system',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(NotificationType), required: true })
  type: NotificationType;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({ type: String })
  deepLink?: string;

  @Prop({ type: Object })
  data?: Record<string, any>;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Date })
  readAt?: Date;

  @Prop({ type: Types.ObjectId, index: true })
  relatedEntityId?: Types.ObjectId;

  @Prop({ type: String })
  relatedEntityType?: string;

  @Prop({ type: String })
  imageUrl?: string;
}

export type NotificationDocument = Notification & Document;
export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
