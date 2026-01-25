import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

/**
 * ⭐ REVIEW SCHEMA
 * 
 * Reviews between artists and venues after completed gigs.
 * Only verified bookers can leave reviews (per core features).
 */
@Schema({
  timestamps: true,
  collection: 'reviews',
  toJSON: { virtuals: true },
})
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reviewerId: Types.ObjectId;

  @Prop({ required: true, enum: ['artist', 'venue'] })
  reviewerRole: 'artist' | 'venue';

  @Prop({ required: true })
  reviewerName: string;

  @Prop()
  reviewerPhoto?: string;

  // Target of the review
  @Prop({ type: Types.ObjectId, refPath: 'targetType', required: true })
  targetId: Types.ObjectId;

  @Prop({ required: true, enum: ['Artist', 'Venue'] })
  targetType: 'Artist' | 'Venue';

  // Associated gig (verification)
  @Prop({ type: Types.ObjectId, ref: 'Gig', required: true })
  gigId: Types.ObjectId;

  @Prop({ required: true })
  gigTitle: string;

  @Prop({ required: true })
  gigDate: Date;

  // Rating breakdown
  @Prop({ required: true, min: 1, max: 5 })
  overallRating: number;

  @Prop({ min: 1, max: 5 })
  performanceRating?: number; // For artists: quality of performance

  @Prop({ min: 1, max: 5 })
  professionalismRating?: number; // Punctuality, communication

  @Prop({ min: 1, max: 5 })
  reliabilityRating?: number; // Showed up, followed through

  @Prop({ min: 1, max: 5 })
  venueQualityRating?: number; // For venues: equipment, space

  @Prop({ min: 1, max: 5 })
  paymentRating?: number; // For venues: paid on time

  // Review content
  @Prop({ required: true, minlength: 10, maxlength: 1000 })
  content: string;

  @Prop({ type: [String], default: [] })
  tags: string[]; // e.g., 'great-sound', 'professional', 'on-time'

  // Photos from the gig
  @Prop({ type: [String], default: [] })
  photos: string[];

  // Response from reviewed party
  @Prop()
  response?: string;

  @Prop()
  responseDate?: Date;

  // Moderation
  @Prop({ default: 'published', enum: ['pending', 'published', 'flagged', 'removed'] })
  status: 'pending' | 'published' | 'flagged' | 'removed';

  @Prop({ default: 0 })
  helpfulCount: number;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  helpfulBy: Types.ObjectId[];

  @Prop({ default: false })
  isVerifiedBooking: boolean;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Indexes
ReviewSchema.index({ targetId: 1, targetType: 1, createdAt: -1 });
ReviewSchema.index({ reviewerId: 1, createdAt: -1 });
ReviewSchema.index({ gigId: 1 }, { unique: true }); // One review per gig per direction
ReviewSchema.index({ overallRating: -1 });
ReviewSchema.index({ status: 1 });
