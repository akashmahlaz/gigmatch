import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BookingDocument = HydratedDocument<Booking>;

/**
 * 📅 BOOKING SCHEMA
 *
 * Confirmed bookings between artists and venues.
 * Includes payment tracking, contract details, and completion status.
 */
@Schema({
  timestamps: true,
  collection: 'bookings',
  toJSON: { virtuals: true },
})
export class Booking {
  // Participants
  @Prop({ type: Types.ObjectId, ref: 'Artist', required: true })
  artist: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Venue', required: true })
  venue: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  artistUser: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  venueUser: Types.ObjectId;

  // Related entities
  @Prop({ type: Types.ObjectId, ref: 'Match' })
  match?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Gig' })
  gig?: Types.ObjectId;

  // Booking Details
  @Prop({ required: true, trim: true })
  title: string;

  @Prop()
  description?: string;

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

  // Payment
  @Prop({ required: true })
  agreedAmount: number;

  @Prop({ default: 'USD' })
  currency: string;

  @Prop(
    raw({
      depositAmount: { type: Number },
      depositPaid: { type: Boolean, default: false },
      depositPaidAt: { type: Date },
      finalAmount: { type: Number },
      finalPaid: { type: Boolean, default: false },
      finalPaidAt: { type: Date },
      stripePaymentIntentId: { type: String },
      stripeFinalPaymentIntentId: { type: String },
      stripeChargeId: { type: String },
    }),
  )
  payment: {
    depositAmount?: number;
    depositPaid: boolean;
    depositPaidAt?: Date;
    finalAmount?: number;
    finalPaid: boolean;
    finalPaidAt?: Date;
    stripePaymentIntentId?: string;
    stripeFinalPaymentIntentId?: string;
    stripeChargeId?: string;
  };

  // Status
  @Prop({
    enum: [
      'pending',
      'confirmed',
      'deposit_paid',
      'paid',
      'in_progress',
      'completed',
      'cancelled',
      'disputed',
    ],
    default: 'pending',
  })
  status:
    | 'pending'
    | 'confirmed'
    | 'deposit_paid'
    | 'paid'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'disputed';

  // Confirmation tracking
  @Prop({ default: false })
  artistConfirmed: boolean;

  @Prop()
  artistConfirmedAt?: Date;

  @Prop({ default: false })
  venueConfirmed: boolean;

  @Prop()
  venueConfirmedAt?: Date;

  // Special requests / terms
  @Prop()
  specialRequests?: string;

  @Prop()
  additionalTerms?: string;

  // Cancellation
  @Prop()
  cancelledAt?: Date;

  @Prop()
  cancelledBy?: string;

  @Prop()
  cancellationReason?: string;

  @Prop({ default: false })
  refundIssued: boolean;

  @Prop()
  refundAmount?: number;

  // Completion
  @Prop()
  completedAt?: Date;

  @Prop({ default: false })
  artistMarkedComplete: boolean;

  @Prop({ default: false })
  venueMarkedComplete: boolean;

  // Review tracking
  @Prop({ default: false })
  artistReviewSubmitted: boolean;

  @Prop({ default: false })
  venueReviewSubmitted: boolean;

  // Contract (optional PDF)
  @Prop()
  contractUrl?: string;

  @Prop({ default: false })
  contractSigned: boolean;

  // Reminder settings
  @Prop({ default: true })
  remindersSent: boolean;

  @Prop()
  lastReminderAt?: Date;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

// Indexes
BookingSchema.index({ artist: 1 });
BookingSchema.index({ venue: 1 });
BookingSchema.index({ artistUser: 1 });
BookingSchema.index({ venueUser: 1 });
BookingSchema.index({ date: 1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ createdAt: -1 });
