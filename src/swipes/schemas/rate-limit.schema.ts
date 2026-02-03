/// 📊 Rate Limit Schema - For atomic rate limiting
///
/// Stores daily rate limit counters for swipe operations
/// Uses atomic upsert operations to prevent race conditions

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../auth/schemas/user.schema';

@Schema({
  timestamps: true,
  collection: 'swipe_rate_limits',
})
export class SwipeRateLimit {
  @ApiProperty({ description: 'User ID' })
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @ApiProperty({ enum: UserRole, description: 'User role' })
  @Prop({ type: String, enum: Object.values(UserRole), required: true })
  role: UserRole;

  @ApiProperty({ description: 'Date key (YYYY-MM-DD format)' })
  @Prop({ required: true, index: true })
  dateKey: string;

  @ApiProperty({ description: 'Swipe count for the day' })
  @Prop({ type: Number, default: 0, min: 0 })
  swipeCount: number;

  @ApiProperty({ description: 'Undo count for the day' })
  @Prop({ type: Number, default: 0, min: 0 })
  undoCount: number;
}

export type SwipeRateLimitDocument = SwipeRateLimit & Document;
export const SwipeRateLimitSchema = SchemaFactory.createForClass(SwipeRateLimit);

// Compound unique index for user + date
SwipeRateLimitSchema.index({ userId: 1, dateKey: 1 }, { unique: true });
