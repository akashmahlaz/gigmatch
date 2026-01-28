/// 🎸 Gig Schema - Gig Opportunities & Bookings
///
/// Stores all gig opportunities posted by venues
/// Supports application workflow and booking management
/// Indexed for efficient discovery and filtering

import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../auth/schemas/user.schema';

/// Status of a gig
export enum GigStatus {
  DRAFT = 'draft', // Venue is editing
  PUBLISHED = 'published', // Open for applications
  FILLED = 'filled', // Artist booked
  COMPLETED = 'completed', // Gig done
  CANCELED = 'canceled', // Venue canceled
  EXPIRED = 'expired', // Past date, no bookings
}

/// Application status
export enum ApplicationStatus {
  PENDING = 'pending', // Awaiting venue review
  ACCEPTED = 'accepted', // Artist accepted
  REJECTED = 'rejected', // Venue declined
  WITHDRAWN = 'withdrawn', // Artist withdrew
  CANCELED = 'canceled', // Application canceled
}

/// Gig type/format
export enum GigType {
  ONE_TIME = 'one_time', // Single gig
  RECURRING = 'recurring', // Regular engagement
  TOUR_DATE = 'tour_date', // Part of tour
  FESTIVAL = 'festival', // Festival/event
  RESIDENCY = 'residency', // Long-term engagement
}

/// Payment type
export enum PaymentType {
  FIXED = 'fixed', // Set fee
  NEGOTIABLE = 'negotiable', // Open to offers
  DOOR = 'door', // Door deal/percentage
  COVER = 'cover', // Cover charge split
  NO_PAY = 'no_pay', // Exposure only
}

/// Main gig schema
@Schema({
  timestamps: true,
  collection: 'gigs',
})
export class Gig {
  /// Venue that posted the gig
  @ApiProperty({ description: 'Venue user ID' })
  @Prop({ type: Types.ObjectId, required: true })
  venue: Types.ObjectId;

  /// Venue name (denormalized for display)
  @ApiProperty({ description: 'Venue name' })
  @Prop({ type: String, required: true })
  venueName: string;

  /// Venue location (denormalized)
  @ApiPropertyOptional({ description: 'Venue location' })
  @Prop({
    type: raw({
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
      address: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      postalCode: { type: String },
    }),
  })
  location?: {
    type: string;
    coordinates: [number, number];
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };

  /// Gig title
  @ApiProperty({ description: 'Gig title', maxLength: 100 })
  @Prop({ type: String, required: true, maxlength: 100 })
  title: string;

  /// Gig description
  @ApiProperty({ description: 'Gig description', maxLength: 2000 })
  @Prop({ type: String, required: true, maxlength: 2000 })
  description: string;

  /// Gig requirements
  @ApiPropertyOptional({
    description: 'Requirements for artists',
    maxLength: 1000,
  })
  @Prop({ type: String, maxlength: 1000 })
  requirements?: string;

  /// Gig type/format
  @ApiProperty({ enum: GigType, description: 'Gig type' })
  @Prop({
    type: String,
    enum: Object.values(GigType),
    default: GigType.ONE_TIME,
  })
  gigType: GigType;

  /// Genre preferences
  @ApiProperty({ type: [String], description: 'Preferred genres' })
  @Prop({ type: [String], default: [] })
  genres: string[];

  /// Date and time
  @ApiProperty({ description: 'Gig date and time' })
  @Prop({ type: Date, required: true })
  date: Date;

  /// End time (if known)
  @ApiPropertyOptional({ description: 'End time' })
  @Prop({ type: Date })
  endTime?: Date;

  /// Setup time (when artist should arrive)
  @ApiPropertyOptional({ description: 'Setup time' })
  @Prop({ type: Date })
  setupTime?: Date;

  /// Duration in hours
  @ApiPropertyOptional({ description: 'Expected duration in hours' })
  @Prop({ type: Number, min: 0.5, max: 24 })
  durationHours?: number;

  /// Payment type
  @ApiProperty({ enum: PaymentType, description: 'Payment type' })
  @Prop({
    type: String,
    enum: Object.values(PaymentType),
    default: PaymentType.FIXED,
  })
  paymentType: PaymentType;

  /// Payment amount (if fixed)
  @ApiPropertyOptional({ description: 'Payment amount in cents' })
  @Prop({ type: Number, min: 0 })
  amount?: number;

  /// Payment currency
  @ApiProperty({ description: 'Currency code', default: 'USD' })
  @Prop({ type: String, default: 'USD' })
  currency: string;

  /// Budget range (min-max for negotiation)
  @ApiPropertyOptional({ description: 'Budget' })
  @Prop({
    type: raw({
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
    }),
  })
  budgetRange?: {
    min: number;
    max: number;
  };

  /// Number of artists needed
  @ApiProperty({ description: 'Number of artists needed', default: 1 })
  @Prop({ type: Number, min: 1, default: 1 })
  artistCount: number;

  /// Equipment provided by venue
  @ApiPropertyOptional({ description: 'Equipment provided', maxLength: 500 })
  @Prop({ type: String, maxlength: 500 })
  equipmentProvided?: string;

  /// Equipment needed from artist
  @ApiPropertyOptional({ description: 'Equipment needed', maxLength: 500 })
  @Prop({ type: String, maxlength: 500 })
  equipmentNeeded?: string;

  /// Parking availability
  @ApiPropertyOptional({ description: 'Parking info', maxLength: 200 })
  @Prop({ type: String, maxlength: 200 })
  parkingInfo?: string;

  /// Meal/drink perks
  @ApiPropertyOptional({ description: 'Perks provided', maxLength: 300 })
  @Prop({ type: String, maxlength: 300 })
  perks?: string;

  /// Gig status
  @ApiProperty({ enum: GigStatus, description: 'Gig status' })
  @Prop({
    type: String,
    enum: Object.values(GigStatus),
    default: GigStatus.DRAFT,
  })
  status: GigStatus;

  /// Number of applicants
  @ApiProperty({ description: 'Application count', default: 0 })
  @Prop({ type: Number, default: 0, min: 0 })
  applicationCount: number;

  /// Views count
  @ApiProperty({ description: 'View count', default: 0 })
  @Prop({ type: Number, default: 0, min: 0 })
  viewCount: number;

  /// Featured/sponsored
  @ApiProperty({ description: 'Featured gig' })
  @Prop({ type: Boolean, default: false })
  isFeatured: boolean;

  /// Boost expiration
  @ApiPropertyOptional({ description: 'Boost expiration time' })
  @Prop({ type: Date })
  boostedUntil?: Date;

  /// Gig images/photos
  @ApiPropertyOptional({ type: [String], description: 'Image URLs' })
  @Prop({ type: [String], default: [] })
  images: string[];

  /// Cover image URL
  @ApiPropertyOptional({ description: 'Cover image URL' })
  @Prop({ type: String })
  coverImage?: string;

  /// Application deadline
  @ApiPropertyOptional({ description: 'Application deadline' })
  @Prop({ type: Date })
  applicationDeadline?: Date;

  /// Cancellation policy
  @ApiPropertyOptional({ description: 'Cancellation policy', maxLength: 500 })
  @Prop({ type: String, maxlength: 500 })
  cancellationPolicy?: string;

  /// Additional notes
  @ApiPropertyOptional({ description: 'Additional notes', maxLength: 1000 })
  @Prop({ type: String, maxlength: 1000 })
  notes?: string;

  /// Reported count
  @ApiProperty({ description: 'Report count', default: 0 })
  @Prop({ type: Number, default: 0, min: 0 })
  reportCount: number;

  /// Report reason if reported
  @ApiPropertyOptional({ description: 'Report reason' })
  @Prop({ type: String })
  reportReason?: string;

  /// IP address for fraud prevention
  @ApiPropertyOptional({ description: 'IP address' })
  @Prop({ type: String })
  ipAddress?: string;

  /// Additional metadata
  @ApiPropertyOptional({ description: 'Additional metadata' })
  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export type GigDocument = Gig & Document;
export const GigSchema = SchemaFactory.createForClass(Gig);

// Compound indexes for efficient queries
GigSchema.index({ venue: 1, status: 1, createdAt: -1 });
GigSchema.index({ status: 1, date: 1, genres: 1 });
GigSchema.index({ location: '2dsphere' }); // 2dsphere index on GeoJSON field for $near queries
GigSchema.index({ genres: 1, status: 1, date: 1 });
GigSchema.index({ status: 1, isFeatured: 1, date: 1 });
GigSchema.index({ venue: 1, status: 1, applicationCount: -1 });
GigSchema.index({ applicationDeadline: 1, status: 1 });
GigSchema.index({ status: 1, viewCount: -1 });
GigSchema.index({ status: 1, paymentType: 1, amount: 1 });

// Text index for search
GigSchema.index({ title: 'text', description: 'text', venueName: 'text' });

// TTL index for automatic cleanup of old completed gigs (2 years)
GigSchema.index(
  { status: 1, completedAt: 1 },
  { expireAfterSeconds: 63072000 },
);

// Static methods for common queries
GigSchema.statics.findByVenue = function (
  venueId: Types.ObjectId,
  status?: GigStatus,
  limit = 20,
) {
  const filter: any = { venue: venueId };
  if (status) filter.status = status;

  return this.find(filter).sort({ createdAt: -1 }).limit(limit).exec();
};

GigSchema.statics.findActive = function (
  filters: {
    genres?: string[];
    maxPrice?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    dateFrom?: Date;
    dateTo?: Date;
  },
  page = 1,
  limit = 20,
) {
  const query: any = {
    status: GigStatus.PUBLISHED,
    date: { $gte: new Date() },
  };

  if (filters.genres?.length) {
    query.genres = { $in: filters.genres };
  }

  if (filters.maxPrice) {
    query.$or = [
      { amount: { $lte: filters.maxPrice } },
      { paymentType: PaymentType.NEGOTIABLE },
      { paymentType: PaymentType.DOOR },
      { paymentType: PaymentType.COVER },
    ];
  }

  if (filters.lat && filters.lng && filters.radiusKm) {
    query.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [filters.lng, filters.lat],
        },
        $maxDistance: filters.radiusKm * 1000,
      },
    };
  }

  if (filters.dateFrom || filters.dateTo) {
    query.date = {};
    if (filters.dateFrom) query.date.$gte = filters.dateFrom;
    if (filters.dateTo) query.date.$lte = filters.dateTo;
  }

  const skip = (page - 1) * limit;

  return Promise.all([
    this.find(query)
      .sort({ date: 1, isFeatured: -1 })
      .skip(skip)
      .limit(limit)
      .exec(),
    this.countDocuments(query).exec(),
  ]).then(([gigs, total]) => ({
    gigs,
    total,
    page,
    pages: Math.ceil(total / limit),
  }));
};

GigSchema.statics.getGigStats = async function (venueId: Types.ObjectId) {
  return this.aggregate([
    { $match: { venue: venueId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalViews: { $sum: '$viewCount' },
        totalApplications: { $sum: '$applicationCount' },
        avgPayment: { $avg: '$amount' },
      },
    },
  ]).exec();
};

GigSchema.statics.incrementView = async function (
  gigId: Types.ObjectId,
): Promise<void> {
  await this.findByIdAndUpdate(gigId, { $inc: { viewCount: 1 } });
};

GigSchema.statics.incrementApplications = async function (
  gigId: Types.ObjectId,
  count = 1,
): Promise<void> {
  await this.findByIdAndUpdate(gigId, { $inc: { applicationCount: count } });
};

// Pre-save hook for validation
GigSchema.pre('save', function (next: any) {
  // Ensure date is in the future for published gigs
  if (this.status === GigStatus.PUBLISHED && this.date < new Date()) {
    return next(new Error('Published gigs must have a future date'));
  }

  // Validate budget range
  if (this.budgetRange) {
    if (this.budgetRange.min > this.budgetRange.max) {
      return next(new Error('Budget min cannot exceed max'));
    }
  }

  // Validate amount for fixed payment
  if (this.paymentType === PaymentType.FIXED && !this.amount) {
    return next(new Error('Fixed payment gigs must have an amount'));
  }

  next();
});

GigSchema.post('find', function (docs) {
  // Increment view count on find (for analytics)
  docs.forEach((doc: any) => {
    if (doc.status === GigStatus.PUBLISHED && doc._id) {
      this.model.updateOne({ _id: doc._id }, { $inc: { viewCount: 1 } }).exec();
    }
  });
});

