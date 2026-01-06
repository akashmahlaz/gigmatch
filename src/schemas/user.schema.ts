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

  @Prop({ required: true, select: false })
  password: string;

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
