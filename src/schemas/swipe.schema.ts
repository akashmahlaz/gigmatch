import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SwipeDocument = HydratedDocument<Swipe>;

/**
 * 👆 SWIPE SCHEMA
 *
 * Records swipe actions between artists and venues.
 * A match occurs when both parties swipe right on each other.
 */
@Schema({
  timestamps: true,
  collection: 'swipes',
})
export class Swipe {
  // Who swiped
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  swiper: Types.ObjectId;

  @Prop({ required: true, enum: ['artist', 'venue'] })
  swiperType: 'artist' | 'venue';

  // Who was swiped on
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  target: Types.ObjectId;

  @Prop({ required: true, enum: ['artist', 'venue'] })
  targetType: 'artist' | 'venue';

  // Swipe action
  @Prop({ required: true, enum: ['like', 'pass', 'superlike'] })
  action: 'like' | 'pass' | 'superlike';

  // Match status
  @Prop({ default: false })
  isMatch: boolean;

  @Prop()
  matchedAt?: Date;

  // Context (optional - which gig prompted the swipe)
  @Prop({ type: Types.ObjectId, ref: 'Gig' })
  relatedGig?: Types.ObjectId;

  // Expiry (for boosted profiles or time-limited visibility)
  @Prop()
  expiresAt?: Date;
}

export const SwipeSchema = SchemaFactory.createForClass(Swipe);

// Compound indexes for efficient queries
SwipeSchema.index({ swiper: 1, target: 1 }, { unique: true });
SwipeSchema.index({ swiper: 1, action: 1 });
SwipeSchema.index({ target: 1, action: 1 });
SwipeSchema.index({ isMatch: 1 });
SwipeSchema.index({ createdAt: -1 });


// Enums
export enum SwipeType {
  LEFT = "left",
  RIGHT = "right",
}

export enum SwipeResult {
  LIKED = "liked",
  SKIPPED = "skipped",
  MATCH = "match",
  EXPIRED = "expired",
}

export enum SwipeDirection {
  LEFT = "left",
  RIGHT = "right",
}

export enum SwipeSource {
  DISCOVERY = "discovery",
  MATCHES = "matches",
  SAVED = "saved",
}
