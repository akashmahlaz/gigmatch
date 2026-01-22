/// 💑 Match Schema - Discovery/Matching System
import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../auth/schemas/user.schema';

export enum MatchStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  BLOCKED = 'blocked',
  ARCHIVED = 'archived',
  EXPIRED = 'expired',
  CONVERTED_TO_BOOKING = 'converted_to_booking',
}

export enum MatchActivity {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  NONE = 'none',
}

@Schema({ timestamps: true, collection: 'matches' })
export class Match {
  @ApiProperty()
  @Prop({ type: Types.ObjectId, index: true, sparse: true })
  artistUser?: Types.ObjectId;
  @ApiProperty()
  @Prop({ type: Types.ObjectId, index: true, sparse: true })
  venueUser?: Types.ObjectId;
  @ApiProperty()
  @Prop({
    type: String,
    enum: Object.values(MatchStatus),
    default: MatchStatus.PENDING,
    index: true,
  })
  status: MatchStatus;
  @ApiProperty()
  @Prop({
    type: String,
    enum: Object.values(MatchActivity),
    default: MatchActivity.NONE,
  })
  activityLevel: MatchActivity;
  @ApiProperty()
  @Prop({ type: Date, default: Date.now, index: true })
  matchedAt: Date;
  @ApiProperty() @Prop({ type: Date }) activatedAt?: Date;
  @ApiProperty() @Prop({ type: Date, index: true }) lastMessageAt?: Date;
  @ApiProperty() @Prop({ type: Date }) artistLastViewedAt?: Date;
  @ApiProperty() @Prop({ type: Date }) venueLastViewedAt?: Date;
  @ApiProperty()
  @Prop({
    type: {
      artist: { type: Number, default: 0, min: 0 },
      venue: { type: Number, default: 0, min: 0 },
    },
    default: { artist: 0, venue: 0 },
  })
  unreadCount: { artist: number; venue: number };
  @ApiProperty()
  @Prop({ type: Boolean, default: false })
  artistFavorited: boolean;
  @ApiProperty()
  @Prop({ type: Boolean, default: false })
  venueFavorited: boolean;
  @ApiProperty() @Prop({ type: String, index: true }) genre?: string;
  @ApiProperty() @Prop({ type: String, maxLength: 500 }) artistNotes?: string;
  @ApiProperty() @Prop({ type: String, maxLength: 500 }) venueNotes?: string;
  @ApiProperty() @Prop({ type: Date }) lastInteractionAt?: Date;
  @ApiProperty() @Prop({ type: String, index: true }) sessionId?: string;
  @ApiProperty() @Prop({ type: String }) ipAddress?: string;
  @ApiProperty() @Prop({ type: Boolean, default: false }) isHidden: boolean;
  @ApiProperty()
  @Prop({ type: Number, default: 0, min: 0 })
  reportCount: number;
  @ApiProperty() @Prop({ type: String }) reportReason?: string;
  @ApiProperty()
  @Prop({ type: Object })
  metadata?: Record<string, any>;
  @ApiProperty()
  @Prop({ type: Boolean, default: false })
  hasMessages: boolean;
  @ApiProperty()
  @Prop({ type: String, maxLength: 500 })
  lastMessagePreview?: string;
  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'Booking', default: null })
  booking?: Types.ObjectId;
}

export type MatchDocument = Match & Document;
export const MatchSchema = SchemaFactory.createForClass(Match);

MatchSchema.index(
  { artistUser: 1, status: 1, createdAt: -1 },
  { sparse: true },
);
MatchSchema.index({ venueUser: 1, status: 1, createdAt: -1 }, { sparse: true });
MatchSchema.index(
  { artistUser: 1, venueUser: 1 },
  { unique: true, sparse: true },
);
MatchSchema.index({ status: 1, lastMessageAt: -1 });
MatchSchema.index({ status: 1, activityLevel: 1, lastInteractionAt: -1 });
MatchSchema.index({ artistUser: 1, artistFavorited: 1 });
MatchSchema.index({ venueUser: 1, venueFavorited: 1 });
MatchSchema.index({ genre: 1, status: 1 });
MatchSchema.index({ createdAt: 1 }, { expireAfterSeconds: 94608000 });
