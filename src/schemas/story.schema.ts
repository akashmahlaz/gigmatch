/// 📖 GIGMATCH STORY SCHEMA
///
/// 24-hour ephemeral stories for artists and venues
/// Auto-expires after 24 hours

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StoryDocument = HydratedDocument<Story>;

// ═══════════════════════════════════════════════════════════════════════════
// STORY ITEM (Individual slide in a story)
// ═══════════════════════════════════════════════════════════════════════════

@Schema({ _id: true, timestamps: true })
export class StoryItem {
  @Prop({ required: true, enum: ['image', 'video'] })
  type: 'image' | 'video';

  @Prop({ required: true })
  url: string;

  @Prop()
  thumbnailUrl?: string;

  @Prop()
  publicId?: string;

  @Prop({ type: Number })
  duration?: number; // For videos or custom image duration (seconds)

  @Prop({ maxlength: 500 })
  caption?: string;

  // Interactive elements
  @Prop()
  link?: string;

  @Prop()
  linkText?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  mentions: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  hashtags: string[];

  // Viewers who have seen this item
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  viewedBy: Types.ObjectId[];

  // Reactions (emoji reactions)
  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User' },
        emoji: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  reactions: Array<{
    userId: Types.ObjectId;
    emoji: string;
    createdAt: Date;
  }>;
}

export const StoryItemSchema = SchemaFactory.createForClass(StoryItem);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN STORY SCHEMA (Container for multiple story items)
// ═══════════════════════════════════════════════════════════════════════════

@Schema({
  timestamps: true,
  collection: 'stories',
  toJSON: {
    virtuals: true,
    transform: (_, ret: Record<string, unknown>) => {
      ret.id = ret._id;
      return ret;
    },
  },
})
export class Story {
  // ═══════════════════════════════════════════════════════════════════
  // AUTHOR
  // ═══════════════════════════════════════════════════════════════════

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Artist', index: true })
  artistId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Venue', index: true })
  venueId?: Types.ObjectId;

  // ═══════════════════════════════════════════════════════════════════
  // STORY ITEMS
  // ═══════════════════════════════════════════════════════════════════

  @Prop({ type: [StoryItemSchema], default: [] })
  items: StoryItem[];

  // ═══════════════════════════════════════════════════════════════════
  // EXPIRATION
  // ═══════════════════════════════════════════════════════════════════

  @Prop({ type: Date, required: true, index: true })
  expiresAt: Date;

  @Prop({ default: false })
  isHighlight: boolean;

  @Prop()
  highlightName?: string;

  // ═══════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════

  @Prop({
    type: String,
    enum: ['active', 'expired', 'deleted'],
    default: 'active',
    index: true,
  })
  status: 'active' | 'expired' | 'deleted';

  // ═══════════════════════════════════════════════════════════════════
  // BOOST (Premium feature)
  // ═══════════════════════════════════════════════════════════════════

  @Prop({ default: false })
  isBoosted: boolean;

  @Prop({ type: Date })
  boostExpiresAt?: Date;

  // Virtual populated field
  author?: {
    _id: Types.ObjectId;
    fullName: string;
    role: string;
    artistProfile?: {
      _id: Types.ObjectId;
      profilePhoto?: string;
      stageName?: string;
      displayName?: string;
      isVerified?: boolean;
    };
    venueProfile?: {
      _id: Types.ObjectId;
      profilePhotoUrl?: string;
      name?: string;
      isVerified?: boolean;
    };
  };
}

export const StorySchema = SchemaFactory.createForClass(Story);

// Indexes
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index - auto deletes expired stories
StorySchema.index({ userId: 1, status: 1, expiresAt: -1 });
StorySchema.index({ createdAt: -1 });
StorySchema.index({ isBoosted: 1, boostExpiresAt: 1 });
