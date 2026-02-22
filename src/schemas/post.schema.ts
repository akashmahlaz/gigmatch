/// 📱 GIGMATCH POST SCHEMA
///
/// Instagram-style posts for artists and venues
/// Supports images, videos, likes, and comments

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostDocument = HydratedDocument<Post>;

// ═══════════════════════════════════════════════════════════════════════════
// EMBEDDED SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/// Media item (image or video)
@Schema({ _id: false })
export class PostMedia {
  @Prop({ required: true, enum: ['image', 'video'] })
  type: 'image' | 'video';

  @Prop({ required: true })
  url: string;

  @Prop()
  thumbnailUrl?: string;

  @Prop()
  publicId?: string; // Cloudinary public ID

  @Prop({ type: Number })
  width?: number;

  @Prop({ type: Number })
  height?: number;

  @Prop({ type: Number })
  duration?: number; // For videos (seconds)

  @Prop({ type: Number, default: 0 })
  order: number;
}

export const PostMediaSchema = SchemaFactory.createForClass(PostMedia);

/// Comment on a post
@Schema({ _id: true, timestamps: true })
export class PostComment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, maxlength: 1000 })
  text: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  likes: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'PostComment' }], default: [] })
  replies: Types.ObjectId[];

  // Populated fields (virtual)
  user?: {
    _id: Types.ObjectId;
    fullName: string;
    role: string;
    artistProfile?: { profilePhoto?: string; stageName?: string };
    venueProfile?: { profilePhotoUrl?: string; name?: string };
  };
}

export const PostCommentSchema = SchemaFactory.createForClass(PostComment);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN POST SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

@Schema({
  timestamps: true,
  collection: 'posts',
  toJSON: {
    virtuals: true,
    transform: (_, ret: Record<string, unknown>) => {
      ret.id = ret._id;
      return ret;
    },
  },
})
export class Post {
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
  // CONTENT
  // ═══════════════════════════════════════════════════════════════════

  @Prop({ maxlength: 2200 })
  caption?: string;

  @Prop({ type: [PostMediaSchema], default: [] })
  media: PostMedia[];

  @Prop({ type: [String], default: [] })
  hashtags: string[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  mentions: Types.ObjectId[];

  // ═══════════════════════════════════════════════════════════════════
  // LOCATION
  // ═══════════════════════════════════════════════════════════════════

  @Prop()
  locationName?: string;

  @Prop({
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  })
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };

  // ═══════════════════════════════════════════════════════════════════
  // ENGAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  likes: Types.ObjectId[];

  @Prop({ type: Number, default: 0 })
  likeCount: number;

  @Prop({ type: [PostCommentSchema], default: [] })
  comments: PostComment[];

  @Prop({ type: Number, default: 0 })
  commentCount: number;

  @Prop({ type: Number, default: 0 })
  shareCount: number;

  @Prop({ type: Number, default: 0 })
  viewCount: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  savedBy: Types.ObjectId[];

  // ═══════════════════════════════════════════════════════════════════
  // TRENDING SCORE
  // ═══════════════════════════════════════════════════════════════════

  @Prop({ type: Number, default: 0, index: true })
  trendingScore: number;

  // ═══════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════

  @Prop({
    type: String,
    enum: ['active', 'hidden', 'deleted', 'reported'],
    default: 'active',
    index: true,
  })
  status: 'active' | 'hidden' | 'deleted' | 'reported';

  @Prop({ default: false })
  isPinned: boolean;

  @Prop({ default: false })
  commentsDisabled: boolean;

  @Prop({ default: false })
  likesHidden: boolean;

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

export const PostSchema = SchemaFactory.createForClass(Post);

// Indexes for efficient queries
PostSchema.index({ createdAt: -1 });
PostSchema.index({ trendingScore: -1, createdAt: -1 });
PostSchema.index({ hashtags: 1 });
PostSchema.index({ location: '2dsphere' });
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ isBoosted: 1, boostExpiresAt: 1 });
