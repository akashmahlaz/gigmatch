import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

/**
 * 🔔 NOTIFICATION SCHEMA
 *
 * Push notifications and in-app notifications.
 */
@Schema({
  timestamps: true,
  collection: 'notifications',
})
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  // Notification type
  @Prop({
    required: true,
    enum: [
      'new_match',
      'new_message',
      'booking_request',
      'booking_confirmed',
      'booking_cancelled',
      'booking_reminder',
      'gig_application',
      'gig_accepted',
      'gig_rejected',
      'new_review',
      'payment_received',
      'payment_due',
      'subscription_expiring',
      'subscription_renewed',
      'profile_boost',
      'system',
    ],
  })
  type: string;

  // Content
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  // Related entities
  @Prop({ type: Types.ObjectId, refPath: 'relatedEntityType' })
  relatedEntity?: Types.ObjectId;

  @Prop({
    enum: ['Match', 'Message', 'Booking', 'Gig', 'Review', 'Subscription'],
  })
  relatedEntityType?: string;

  // Deep link
  @Prop()
  actionUrl?: string;

  // Status
  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  readAt?: Date;

  @Prop({ default: false })
  isPushed: boolean;

  @Prop()
  pushedAt?: Date;

  // Priority
  @Prop({
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  })
  priority: 'low' | 'normal' | 'high' | 'urgent';

  // Expiry
  @Prop()
  expiresAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes
NotificationSchema.index({ user: 1, isRead: 1 });
NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
