import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

// Class for JWT payload user data (used in decorators)
export class UserPayload {
  _id: Types.ObjectId;
  email: string;
  fullName: string;
  role: 'artist' | 'venue' | 'admin';
}

/**
 * 👤 USER SCHEMA
 *
 * Base user model for authentication.
 * Links to either Artist or Venue profile.
 *
 * Roles:
 * - artist: Musicians/bands looking for gigs
 * - venue: Event organizers/venue owners posting gigs
 * - admin: Platform administrators
 */
@Schema({
  timestamps: true,
  collection: 'users',
  toJSON: {
    virtuals: true,
    transform: (_, ret: Record<string, any>) => {
      delete ret.password;
      delete ret.refreshToken;
      return ret;
    },
  },
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ select: false })
  password?: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({
    required: true,
    enum: ['artist', 'venue', 'admin'],
    default: 'artist',
  })
  role: 'artist' | 'venue' | 'admin';

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ default: false })
  isPhoneVerified: boolean;

  @Prop()
  phone?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isBanned: boolean;

  @Prop()
  banReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'Artist' })
  artistProfile?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Venue' })
  venueProfile?: Types.ObjectId;

  // Push notification tokens
  @Prop({ type: [String], default: [] })
  fcmTokens: string[];

  // Account settings
  @Prop({ default: true })
  pushNotificationsEnabled: boolean;

  @Prop({ default: true })
  emailNotificationsEnabled: boolean;

  /// Notification preferences
  @Prop({
    type: {
      notificationsEnabled: { type: Boolean, default: true },
      matchNotifications: { type: Boolean, default: true },
      messageNotifications: { type: Boolean, default: true },
      gigNotifications: { type: Boolean, default: true },
      bookingNotifications: { type: Boolean, default: true },
      reviewNotifications: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: false },
      pushNotifications: { type: Boolean, default: true },
      quietHoursEnabled: { type: Boolean, default: false },
      quietHoursStart: { type: String, default: '22:00' },
      quietHoursEnd: { type: String, default: '08:00' },
    },
    default: {
      notificationsEnabled: true,
      matchNotifications: true,
      messageNotifications: true,
      gigNotifications: true,
      bookingNotifications: true,
      reviewNotifications: true,
      emailNotifications: false,
      pushNotifications: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    },
  })
  notificationPreferences: {
    notificationsEnabled: boolean;
    matchNotifications: boolean;
    messageNotifications: boolean;
    gigNotifications: boolean;
    bookingNotifications: boolean;
    reviewNotifications: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
  };

  /// Privacy settings
  @Prop({
    type: {
      showOnlineStatus: { type: Boolean, default: true },
      showDistance: { type: Boolean, default: true },
      maxDistance: { type: Number, default: 50 },
    },
    default: {
      showOnlineStatus: true,
      showDistance: true,
      maxDistance: 50,
    },
  })
  privacySettings: {
    showOnlineStatus: boolean;
    showDistance: boolean;
    maxDistance: number;
  };

  // Subscription fields (denormalized for quick access)
  @Prop({ default: 'free', enum: ['free', 'pro', 'premium'] })
  subscriptionTier: string;

  @Prop({ default: false })
  hasActiveSubscription: boolean;

  // Subscription (for artists)
  @Prop({ type: Types.ObjectId, ref: 'Subscription' })
  subscription?: Types.ObjectId;

  @Prop()
  stripeCustomerId?: string;

  // Auth tokens
  @Prop({ select: false })
  refreshToken?: string;

  @Prop()
  emailVerificationToken?: string;

  @Prop()
  emailVerificationExpires?: Date;

  @Prop()
  passwordResetToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  // Social login IDs
  @Prop({ sparse: true })
  googleId?: string;

  @Prop({ sparse: true })
  appleId?: string;

  // Profile photo (from social login or uploaded)
  @Prop()
  profilePhotoUrl?: string;

  @Prop()
  lastLoginAt?: Date;

  // Timestamps are added automatically by mongoose when timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes (email index already created by unique: true)
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
