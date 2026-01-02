import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VenueDocument = HydratedDocument<Venue>;

/**
 * 🏟️ VENUE SCHEMA
 *
 * Complete venue profile for bars, clubs, restaurants, etc.
 * Includes capacity, equipment, and booking requirements.
 */
@Schema({
  timestamps: true,
  collection: 'venues',
  toJSON: { virtuals: true },
})
export class Venue {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  user: Types.ObjectId;

  // Basic Info
  @Prop({ required: true, trim: true })
  venueName: string;

  @Prop({
    required: true,
    enum: [
      'bar',
      'club',
      'restaurant',
      'concert_hall',
      'hotel',
      'private_events',
      'festival',
      'other',
    ],
  })
  venueType:
    | 'bar'
    | 'club'
    | 'restaurant'
    | 'concert_hall'
    | 'hotel'
    | 'private_events'
    | 'festival'
    | 'other';

  @Prop({ maxlength: 500 })
  description?: string;

  @Prop({ type: [String], default: [] })
  preferredGenres: string[];

  // Media
  @Prop()
  coverPhoto?: string;

  @Prop()
  logo?: string;

  @Prop({ type: [String], default: [] })
  photoGallery: string[];

  @Prop(
    raw([
      {
        title: { type: String },
        url: { type: String, required: true },
      },
    ]),
  )
  videos: { title?: string; url: string }[];

  // Contact & Location
  @Prop()
  phone?: string;

  @Prop({ default: false })
  showPhoneOnProfile: boolean;

  @Prop()
  contactEmail?: string;

  @Prop(
    raw({
      streetAddress: { type: String },
      city: { type: String, required: true },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String, required: true },
      coordinates: {
        type: [Number],
        // Index declared below with VenueSchema.index()
      },
    }),
  )
  location: {
    streetAddress?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
    coordinates?: number[];
  };

  @Prop(
    raw({
      instagram: { type: String },
      facebook: { type: String },
      twitter: { type: String },
      website: { type: String },
      yelp: { type: String },
      googleMaps: { type: String },
    }),
  )
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    website?: string;
    yelp?: string;
    googleMaps?: string;
  };

  // Capacity & Technical
  @Prop({ default: 100 })
  capacity: number;

  @Prop(
    raw({
      hasSoundSystem: { type: Boolean, default: false },
      hasLighting: { type: Boolean, default: false },
      hasStage: { type: Boolean, default: false },
      hasDressingRoom: { type: Boolean, default: false },
      hasParking: { type: Boolean, default: false },
      hasBackline: { type: Boolean, default: false },
      additionalEquipment: { type: [String], default: [] },
    }),
  )
  equipment: {
    hasSoundSystem: boolean;
    hasLighting: boolean;
    hasStage: boolean;
    hasDressingRoom: boolean;
    hasParking: boolean;
    hasBackline: boolean;
    additionalEquipment: string[];
  };

  // Operating Hours
  @Prop(
    raw({
      monday: { open: String, close: String, isClosed: Boolean },
      tuesday: { open: String, close: String, isClosed: Boolean },
      wednesday: { open: String, close: String, isClosed: Boolean },
      thursday: { open: String, close: String, isClosed: Boolean },
      friday: { open: String, close: String, isClosed: Boolean },
      saturday: { open: String, close: String, isClosed: Boolean },
      sunday: { open: String, close: String, isClosed: Boolean },
    }),
  )
  operatingHours?: {
    monday?: { open: string; close: string; isClosed: boolean };
    tuesday?: { open: string; close: string; isClosed: boolean };
    wednesday?: { open: string; close: string; isClosed: boolean };
    thursday?: { open: string; close: string; isClosed: boolean };
    friday?: { open: string; close: string; isClosed: boolean };
    saturday?: { open: string; close: string; isClosed: boolean };
    sunday?: { open: string; close: string; isClosed: boolean };
  };

  // Budget
  @Prop({ default: 0 })
  minBudget: number;

  @Prop({ default: 5000 })
  maxBudget: number;

  @Prop({ default: 'USD' })
  currency: string;

  // Reputation & Stats
  @Prop({ default: 0, min: 0, max: 5 })
  averageRating: number;

  @Prop({ default: 0 })
  totalReviews: number;

  @Prop({ default: 0 })
  completedBookings: number;

  @Prop({ default: 100 })
  reliabilityScore: number;

  @Prop({ default: 0 })
  profileViews: number;

  // Visibility
  @Prop({ default: false })
  isProfileVisible: boolean;

  @Prop({ default: false })
  isAcceptingBookings: boolean;

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

export const VenueSchema = SchemaFactory.createForClass(Venue);

// Indexes for search and discovery
VenueSchema.index({ 'location.coordinates': '2dsphere' });
VenueSchema.index({ preferredGenres: 1 });
VenueSchema.index({ isProfileVisible: 1 });
VenueSchema.index({ isAcceptingBookings: 1 });
VenueSchema.index({ venueType: 1 });
VenueSchema.index({ averageRating: -1 });
VenueSchema.index({ 'location.city': 1, 'location.country': 1 });
