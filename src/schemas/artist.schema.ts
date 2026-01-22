import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ArtistDocument = HydratedDocument<Artist>;

/**
 * 🎸 ARTIST SCHEMA
 *
 * Complete artist/band profile for musicians.
 * Includes media, availability, pricing, and location.
 */
@Schema({
  timestamps: true,
  collection: 'artists',
  toJSON: { virtuals: true },
})
export class Artist {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  user: Types.ObjectId;

  // Basic Info
  @Prop({ required: true, trim: true })
  displayName: string;

  @Prop({ trim: true })
  stageName?: string;

  @Prop({ maxlength: 500 })
  bio?: string;

  @Prop({ type: [String], default: [] })
  genres: string[];

  @Prop({ type: [String], default: [] })
  influences: string[];

  // Media
  @Prop()
  profilePhoto?: string;

  @Prop({ type: [String], default: [] })
  photoGallery: string[];

  @Prop(
    raw([
      {
        title: { type: String, required: true },
        url: { type: String, required: true },
        duration: { type: Number },
      },
    ]),
  )
  audioSamples: { title: string; url: string; duration?: number }[];

  @Prop(
    raw([
      {
        title: { type: String, required: true },
        url: { type: String, required: true },
        thumbnailUrl: { type: String },
        platform: { type: String },
      },
    ]),
  )
  videoSamples: {
    title: string;
    url: string;
    thumbnailUrl?: string;
    platform?: string;
  }[];

  // Contact
  @Prop()
  phone?: string;

  @Prop({ default: false })
  showPhoneOnProfile: boolean;

  @Prop()
  email?: string;

  @Prop(
    raw({
      instagram: { type: String },
      spotify: { type: String },
      youtube: { type: String },
      website: { type: String },
      soundcloud: { type: String },
      tiktok: { type: String },
    }),
  )
  socialLinks?: {
    instagram?: string;
    spotify?: string;
    youtube?: string;
    website?: string;
    soundcloud?: string;
    tiktok?: string;
  };

  // Location
  @Prop(
    raw({
      city: { type: String },
      country: { type: String },
      coordinates: {
        type: [Number],
        // Index declared below with ArtistSchema.index()
      },
      travelRadius: { type: Number, default: 50 },
    }),
  )
  location?: {
    city?: string;
    country?: string;
    coordinates?: number[];
    travelRadius: number;
  };

  // Availability
  @Prop(
    raw([
      {
        date: { type: Date, required: true },
        startTime: { type: String },
        endTime: { type: String },
        isAvailable: { type: Boolean, default: true },
      },
    ]),
  )
  availability: {
    date: Date;
    startTime?: string;
    endTime?: string;
    isAvailable: boolean;
  }[];

  // Pricing
  @Prop({ default: 100 })
  minPrice: number;

  @Prop({ default: 1000 })
  maxPrice: number;

  @Prop({ default: 'USD' })
  currency: string;

  // Reputation & Stats
  @Prop({ default: 0, min: 0, max: 5 })
  averageRating: number;

  @Prop({ default: 0 })
  totalReviews: number;

  @Prop({ default: 0 })
  completedGigs: number;

  @Prop({ default: 100 })
  reliabilityScore: number;

  @Prop({ default: 0 })
  profileViews: number;

  // Subscription & Visibility
  @Prop({
    enum: ['free', 'basic', 'pro'],
    default: 'free',
  })
  subscriptionTier: 'free' | 'basic' | 'pro';

  @Prop({ default: false })
  isProfileVisible: boolean;

  @Prop({ default: false })
  isBoosted: boolean;

  @Prop()
  boostExpiresAt?: Date;

  // Verification
  @Prop({ default: false })
  isVerified: boolean;

  @Prop()
  verifiedAt?: Date;

  // Profile completion
  @Prop({ default: 0 })
  profileCompletionPercent: number;

  @Prop({ default: false })
  hasCompletedSetup: boolean;
}

export const ArtistSchema = SchemaFactory.createForClass(Artist);

// Indexes for search and discovery
ArtistSchema.index({ 'location.coordinates': '2dsphere' });
ArtistSchema.index({ genres: 1 });
ArtistSchema.index({ isProfileVisible: 1 });
ArtistSchema.index({ subscriptionTier: 1 });
ArtistSchema.index({ averageRating: -1 });
ArtistSchema.index({ isBoosted: 1, boostExpiresAt: 1 });
ArtistSchema.index({ 'location.city': 1, 'location.country': 1 });
