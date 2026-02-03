import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MatchDocument = HydratedDocument<Match>;

/**
 * 🤝 MATCH SCHEMA
 *
 * Created when both artist and venue swipe right on each other.
 * Enables messaging and booking between matched parties.
 */
@Schema({
  timestamps: true,
  collection: 'matches',
  toJSON: { virtuals: true },
})
export class Match {
  // Participants
  @Prop({ type: Types.ObjectId, ref: 'Artist', required: true })
  artist: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Venue', required: true })
  venue: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  artistUser: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  venueUser: Types.ObjectId;

  // Match context
  @Prop({ type: Types.ObjectId, ref: 'Gig' })
  relatedGig?: Types.ObjectId;

  // Status
  @Prop({
    enum: ['active', 'archived', 'blocked', 'converted_to_booking'],
    default: 'active',
  })
  status: 'active' | 'archived' | 'blocked' | 'converted_to_booking';

  // Chat
  @Prop({ default: false })
  hasMessages: boolean;

  @Prop()
  lastMessageAt?: Date;

  @Prop()
  lastMessagePreview?: string;

  // Unread counts
  @Prop(
    raw({
      artist: { type: Number, default: 0 },
      venue: { type: Number, default: 0 },
    }),
  )
  unreadCount: {
    artist: number;
    venue: number;
  };

  // Booking reference
  @Prop({ type: Types.ObjectId, ref: 'Booking' })
  booking?: Types.ObjectId;

  // Interaction tracking
  @Prop()
  artistLastViewedAt?: Date;

  @Prop()
  venueLastViewedAt?: Date;

  // Who initiated
  @Prop({ enum: ['artist', 'venue'] })
  initiatedBy?: 'artist' | 'venue';

  // Mute settings per user
  @Prop(
    raw({
      artist: { type: Boolean, default: false },
      venue: { type: Boolean, default: false },
    }),
  )
  isMuted: {
    artist: boolean;
    venue: boolean;
  };

  // Pin settings per user
  @Prop(
    raw({
      artist: { type: Boolean, default: false },
      venue: { type: Boolean, default: false },
    }),
  )
  isPinned: {
    artist: boolean;
    venue: boolean;
  };

  // Block info
  @Prop({ type: Types.ObjectId, ref: 'User' })
  blockedBy?: Types.ObjectId;

  @Prop()
  blockedAt?: Date;

  @Prop()
  blockReason?: string;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export const MatchSchema = SchemaFactory.createForClass(Match);

// Indexes
MatchSchema.index({ artist: 1, venue: 1 }, { unique: true });
MatchSchema.index({ artistUser: 1 });
MatchSchema.index({ venueUser: 1 });
MatchSchema.index({ status: 1 });
MatchSchema.index({ lastMessageAt: -1 });
MatchSchema.index({ createdAt: -1 });
