import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type GigDocument = HydratedDocument<Gig>;

/**
 * 🎤 GIG SCHEMA
 *
 * Represents a gig/event posted by a venue.
 * Artists can apply to gigs or venues can directly invite artists.
 *
 * 📍 Location:
 * - Stores an exact Point (GeoJSON) for radius-based discovery ($near)
 * - Also stores city/country as human-readable labels
 */
@Schema({
  timestamps: true,
  collection: 'gigs',
  toJSON: { virtuals: true },
})
export class Gig {
  @Prop({ type: Types.ObjectId, ref: 'Venue', required: true })
  venue: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  postedBy: Types.ObjectId;

  // Basic Info
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ maxlength: 1000 })
  description?: string;

  // Date & Time
  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  startTime: string;

  @Prop()
  endTime?: string;

  @Prop({ default: 60 })
  durationMinutes: number;

  @Prop({ default: 1 })
  numberOfSets: number;

  // Music Requirements
  @Prop({ type: [String], default: [] })
  requiredGenres: string[];

  @Prop()
  specificRequirements?: string;

  @Prop({ default: 1 })
  artistsNeeded: number;

  // Budget
  @Prop({ required: true })
  budget: number;

  @Prop({ default: 'USD' })
  currency: string;

  @Prop({
    enum: ['fixed', 'negotiable', 'per_hour'],
    default: 'fixed',
  })
  paymentType: 'fixed' | 'negotiable' | 'per_hour';

  // Location (exact geospatial + readable fields)
  @Prop(
    raw({
      venueAddress: { type: String },
      city: { type: String, required: true },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String, required: true },

      // GeoJSON Point for $near queries (lng, lat)
      geo: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: true,
        },
      },
    }),
  )
  location: {
    venueAddress?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
    geo: {
      type: 'Point';
      coordinates: number[]; // [lng, lat]
    };
  };

  // Applications
  @Prop(
    raw([
      {
        artist: { type: Types.ObjectId, ref: 'Artist', required: true },
        appliedAt: { type: Date, default: Date.now },
        message: { type: String },
        proposedRate: { type: Number },
        status: {
          type: String,
          enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
          default: 'pending',
        },
      },
    ]),
  )
  applications: {
    artist: Types.ObjectId;
    appliedAt: Date;
    message?: string;
    proposedRate?: number;
    status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  }[];

  // Booked Artist(s)
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Artist' }], default: [] })
  bookedArtists: Types.ObjectId[];

  // Visibility
  @Prop({ default: true })
  isPublic: boolean;

  @Prop({ default: true })
  acceptingApplications: boolean;

  // Perks
  @Prop(
    raw({
      providesFood: { type: Boolean, default: false },
      providesDrinks: { type: Boolean, default: false },
      providesAccommodation: { type: Boolean, default: false },
      providesTransport: { type: Boolean, default: false },
      additionalPerks: { type: [String], default: [] },
    }),
  )
  perks: {
    providesFood: boolean;
    providesDrinks: boolean;
    providesAccommodation: boolean;
    providesTransport: boolean;
    additionalPerks: string[];
  };

  // Stats
  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: 0 })
  applicationCount: number;

  // Cancellation
  @Prop()
  cancelledAt?: Date;

  @Prop()
  cancellationReason?: string;

  // Completion
  @Prop()
  completedAt?: Date;
}

export const GigSchema = SchemaFactory.createForClass(Gig);

// Indexes for search and discovery
GigSchema.index({ venue: 1 });
GigSchema.index({ date: 1 });
GigSchema.index({ status: 1 });
GigSchema.index({ requiredGenres: 1 });
GigSchema.index({ budget: 1 });
GigSchema.index({ 'applications.artist': 1 });
GigSchema.index({ bookedArtists: 1 });
GigSchema.index({ createdAt: -1 });

// Geospatial index for radius-based discovery ($near)
GigSchema.index({ 'location.geo': '2dsphere' });
GigSchema.index({ 'location.city': 1, 'location.country': 1 });
