import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

/**
 * ⭐ REVIEW SCHEMA
 *
 * Reviews can only be submitted after a completed booking.
 * Both artists and venues can review each other.
 * Only verified (completed booking) users can leave reviews.
 */
@Schema({
  timestamps: true,
  collection: 'reviews',
  toJSON: { virtuals: true },
})
export class Review {
  // Required: Must have a completed booking to leave a review
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true })
  booking: Types.ObjectId;

  // Reviewer
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reviewer: Types.ObjectId;

  @Prop({ required: true, enum: ['artist', 'venue'] })
  reviewerType: 'artist' | 'venue';

  // Who is being reviewed
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reviewee: Types.ObjectId;

  @Prop({ required: true, enum: ['artist', 'venue'] })
  revieweeType: 'artist' | 'venue';

  // Profile references for easier queries
  @Prop({ type: Types.ObjectId, refPath: 'revieweeType' })
  revieweeProfile?: Types.ObjectId;

  // Ratings (1-5 scale)
  @Prop({ required: true, min: 1, max: 5 })
  overallRating: number;

  @Prop({ min: 1, max: 5 })
  professionalismRating?: number;

  @Prop({ min: 1, max: 5 })
  communicationRating?: number;

  @Prop({ min: 1, max: 5 })
  punctualityRating?: number;

  // For artist reviews (by venues)
  @Prop({ min: 1, max: 5 })
  performanceRating?: number;

  @Prop({ min: 1, max: 5 })
  crowdEngagementRating?: number;

  // For venue reviews (by artists)
  @Prop({ min: 1, max: 5 })
  venueQualityRating?: number;

  @Prop({ min: 1, max: 5 })
  equipmentRating?: number;

  @Prop({ min: 1, max: 5 })
  paymentReliabilityRating?: number;

  // Written review
  @Prop({ maxlength: 1000 })
  comment?: string;

  // Tags
  @Prop({ type: [String], default: [] })
  positiveTags: string[];

  @Prop({ type: [String], default: [] })
  negativeTags: string[];

  // Verification
  @Prop({ default: true })
  isVerified: boolean; // Automatically true since booking is required

  // Visibility
  @Prop({ default: true })
  isPublic: boolean;

  @Prop({ default: false })
  isHidden: boolean; // Hidden by admin

  @Prop()
  hiddenReason?: string;

  // Response from reviewee
  @Prop()
  response?: string;

  @Prop()
  respondedAt?: Date;

  // Helpful votes
  @Prop({ default: 0 })
  helpfulCount: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  helpfulVoters: Types.ObjectId[];

  // Reports
  @Prop({ default: false })
  isReported: boolean;

  @Prop({ default: 0 })
  reportCount: number;

  @Prop()
  reportReason?: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Indexes
ReviewSchema.index({ booking: 1, reviewer: 1 }, { unique: true }); // One review per booking per user
ReviewSchema.index({ reviewee: 1, isPublic: 1 });
ReviewSchema.index({ revieweeType: 1 });
ReviewSchema.index({ overallRating: -1 });
ReviewSchema.index({ createdAt: -1 });
ReviewSchema.index({ isVerified: 1, isPublic: 1 });
