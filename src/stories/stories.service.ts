/// 📖 GIGMATCH STORIES SERVICE
///
/// Business logic for 24-hour ephemeral stories

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Story, StoryDocument } from '../schemas/story.schema';
import { User, UserDocument } from '../schemas/user.schema';
import {
  CreateStoryDto,
  AddStoryItemDto,
  ReactToStoryDto,
  StoriesQueryDto,
} from './dto';

// Story response type with additional metadata
export interface StoryWithMeta {
  _id: Types.ObjectId;
  userId: Types.ObjectId | {
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
  artistId?: Types.ObjectId;
  venueId?: Types.ObjectId;
  items: any[];
  status: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  author?: any;
  hasUnviewed?: boolean;
  viewedItemIds?: string[];
  latestItemUrl?: string;
}

@Injectable()
export class StoriesService {
  private readonly logger = new Logger(StoriesService.name);

  constructor(
    @InjectModel(Story.name) private storyModel: Model<StoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE STORY
  // ═══════════════════════════════════════════════════════════════════════════

  async create(userId: string, dto: CreateStoryDto): Promise<Story> {
    this.logger.log(`stories:create userId=${userId} items=${dto.items.length}`);

    const user = await this.userModel
      .findById(userId)
      .populate('artistProfile')
      .populate('venueProfile');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate expiry (default 24 hours)
    const expiryHours = dto.expiryHours ?? 24;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    // Get artistId and venueId properly (handle both populated and non-populated cases)
    let artistId: Types.ObjectId | undefined;
    let venueId: Types.ObjectId | undefined;

    if (user.artistProfile) {
      // Check if it's a populated document or just an ObjectId
      if (typeof user.artistProfile === 'object' && user.artistProfile._id) {
        artistId = new Types.ObjectId(user.artistProfile._id.toString());
      } else {
        artistId = new Types.ObjectId(user.artistProfile.toString());
      }
    }

    if (user.venueProfile) {
      if (typeof user.venueProfile === 'object' && user.venueProfile._id) {
        venueId = new Types.ObjectId(user.venueProfile._id.toString());
      } else {
        venueId = new Types.ObjectId(user.venueProfile.toString());
      }
    }

    // Check if user already has an active story
    const existingStory = await this.storyModel.findOne({
      userId: new Types.ObjectId(userId),
      status: 'active',
      expiresAt: { $gt: new Date() },
    });

    if (existingStory) {
      // Add items to existing story
      const newItems = dto.items.map((item) => ({
        ...item,
        mentions: item.mentions?.map((id) => new Types.ObjectId(id)) || [],
        hashtags: item.hashtags || [],
        viewedBy: [],
        reactions: [],
      }));

      existingStory.items.push(...(newItems as never[]));
      await existingStory.save();

      return this.findById(existingStory._id.toString(), userId);
    }

    // Create new story
    const story = new this.storyModel({
      userId: new Types.ObjectId(userId),
      artistId,
      venueId,
      items: dto.items.map((item) => ({
        ...item,
        mentions: item.mentions?.map((id) => new Types.ObjectId(id)) || [],
        hashtags: item.hashtags || [],
        viewedBy: [],
        reactions: [],
      })),
      expiresAt,
    });

    try {
      await story.save();
      this.logger.log(`stories:created id=${story._id}`);
    } catch (error) {
      this.logger.error(`stories:create error: ${error.message}`, error.stack);
      throw error;
    }

    return this.findById(story._id.toString(), userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET STORIES FEED
  // ═══════════════════════════════════════════════════════════════════════════

  async getFeed(
    userId: string,
    query: StoriesQueryDto,
  ): Promise<{ stories: StoryWithMeta[]; hasMore: boolean }> {
    const { page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    this.logger.log(`stories:feed userId=${userId} page=${page}`);

    const now = new Date();

    // Get all active, non-expired stories
    const stories = await this.storyModel
      .find({
        status: 'active',
        expiresAt: { $gt: now },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .populate({
        path: 'userId',
        select: 'fullName role artistProfile venueProfile',
        populate: [
          {
            path: 'artistProfile',
            select: '_id profilePhoto stageName displayName isVerified',
          },
          {
            path: 'venueProfile',
            select: '_id profilePhotoUrl name isVerified',
          },
        ],
      })
      .lean();

    const hasMore = stories.length > limit;
    const resultStories = hasMore ? stories.slice(0, limit) : stories;

    const userObjectId = new Types.ObjectId(userId);

    // Enrich with view status
    const enrichedStories: StoryWithMeta[] = resultStories.map((story) => {
      // Find which items the user has viewed
      const viewedItemIds = story.items
        .filter((item) =>
          (item.viewedBy as Types.ObjectId[]).some((id) =>
            id.equals(userObjectId),
          ),
        )
        .map((item) => (item as unknown as { _id: Types.ObjectId })._id.toString());

      const hasUnviewed = viewedItemIds.length < story.items.length;

      return {
        ...story,
        author: story.userId,
        hasUnviewed,
        viewedItemIds,
        latestItemUrl: story.items[story.items.length - 1]?.url,
      } as unknown as StoryWithMeta;
    });

    // Sort: user's own story first, then unviewed, then viewed
    enrichedStories.sort((a, b) => {
      const aIsOwn = (a.userId as unknown as { _id: Types.ObjectId })._id.equals(userObjectId);
      const bIsOwn = (b.userId as unknown as { _id: Types.ObjectId })._id.equals(userObjectId);

      if (aIsOwn && !bIsOwn) return -1;
      if (!aIsOwn && bIsOwn) return 1;

      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;

      return 0;
    });

    return { stories: enrichedStories, hasMore };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET SINGLE STORY
  // ═══════════════════════════════════════════════════════════════════════════

  async findById(storyId: string, userId?: string): Promise<Story> {
    const story = await this.storyModel
      .findById(storyId)
      .populate({
        path: 'userId',
        select: 'fullName role artistProfile venueProfile',
        populate: [
          {
            path: 'artistProfile',
            select: '_id profilePhoto stageName displayName isVerified',
          },
          {
            path: 'venueProfile',
            select: '_id profilePhotoUrl name isVerified',
          },
        ],
      })
      .lean();

    if (!story || story.status === 'deleted') {
      throw new NotFoundException('Story not found');
    }

    return { ...story, author: story.userId } as unknown as Story;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET USER'S STORY
  // ═══════════════════════════════════════════════════════════════════════════

  async getUserStory(targetUserId: string, currentUserId: string): Promise<Story | null> {
    const story = await this.storyModel
      .findOne({
        userId: new Types.ObjectId(targetUserId),
        status: 'active',
        expiresAt: { $gt: new Date() },
      })
      .populate({
        path: 'userId',
        select: 'fullName role artistProfile venueProfile',
        populate: [
          {
            path: 'artistProfile',
            select: '_id profilePhoto stageName displayName isVerified',
          },
          {
            path: 'venueProfile',
            select: '_id profilePhotoUrl name isVerified',
          },
        ],
      })
      .lean();

    if (!story) {
      return null;
    }

    return { ...story, author: story.userId } as unknown as Story;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADD ITEM TO EXISTING STORY
  // ═══════════════════════════════════════════════════════════════════════════

  async addItem(storyId: string, userId: string, dto: AddStoryItemDto): Promise<Story> {
    const story = await this.storyModel.findById(storyId);

    if (!story || story.status !== 'active') {
      throw new NotFoundException('Story not found');
    }

    if (story.userId.toString() !== userId) {
      throw new ForbiddenException('Cannot modify this story');
    }

    const newItem = {
      ...dto,
      mentions: dto.mentions?.map((id) => new Types.ObjectId(id)) || [],
      hashtags: dto.hashtags || [],
      viewedBy: [],
      reactions: [],
    };

    story.items.push(newItem as never);
    await story.save();

    return this.findById(storyId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MARK ITEM AS VIEWED
  // ═══════════════════════════════════════════════════════════════════════════

  async markViewed(storyId: string, itemId: string, userId: string): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);

    await this.storyModel.updateOne(
      {
        _id: new Types.ObjectId(storyId),
        'items._id': new Types.ObjectId(itemId),
      },
      {
        $addToSet: { 'items.$.viewedBy': userObjectId },
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REACT TO STORY ITEM
  // ═══════════════════════════════════════════════════════════════════════════

  async reactToItem(storyId: string, userId: string, dto: ReactToStoryDto): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);

    // Remove existing reaction from this user, then add new one
    await this.storyModel.updateOne(
      {
        _id: new Types.ObjectId(storyId),
        'items._id': new Types.ObjectId(dto.itemId),
      },
      {
        $pull: { 'items.$.reactions': { userId: userObjectId } },
      },
    );

    await this.storyModel.updateOne(
      {
        _id: new Types.ObjectId(storyId),
        'items._id': new Types.ObjectId(dto.itemId),
      },
      {
        $push: {
          'items.$.reactions': {
            userId: userObjectId,
            emoji: dto.emoji,
            createdAt: new Date(),
          },
        },
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE STORY
  // ═══════════════════════════════════════════════════════════════════════════

  async delete(storyId: string, userId: string): Promise<void> {
    const story = await this.storyModel.findById(storyId);

    if (!story || story.status === 'deleted') {
      throw new NotFoundException('Story not found');
    }

    if (story.userId.toString() !== userId) {
      throw new ForbiddenException('Cannot delete this story');
    }

    story.status = 'deleted';
    await story.save();

    this.logger.log(`stories:deleted storyId=${storyId} by=${userId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE SINGLE ITEM
  // ═══════════════════════════════════════════════════════════════════════════

  async deleteItem(storyId: string, itemId: string, userId: string): Promise<Story> {
    const story = await this.storyModel.findById(storyId);

    if (!story || story.status !== 'active') {
      throw new NotFoundException('Story not found');
    }

    if (story.userId.toString() !== userId) {
      throw new ForbiddenException('Cannot modify this story');
    }

    story.items = story.items.filter(
      (item) => (item as unknown as { _id: Types.ObjectId })._id.toString() !== itemId,
    );

    // If no items left, delete the story
    if (story.items.length === 0) {
      story.status = 'deleted';
    }

    await story.save();

    if (story.status === 'deleted') {
      throw new NotFoundException('Story deleted (no items remaining)');
    }

    return this.findById(storyId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET STORY VIEWERS
  // ═══════════════════════════════════════════════════════════════════════════

  async getViewers(
    storyId: string,
    itemId: string,
    userId: string,
  ): Promise<{ viewers: unknown[]; total: number }> {
    const story = await this.storyModel.findById(storyId);

    if (!story || story.status !== 'active') {
      throw new NotFoundException('Story not found');
    }

    if (story.userId.toString() !== userId) {
      throw new ForbiddenException('Only story owner can view viewers');
    }

    const item = story.items.find(
      (i) => (i as unknown as { _id: Types.ObjectId })._id.toString() === itemId,
    );

    if (!item) {
      throw new NotFoundException('Story item not found');
    }

    // Get viewer details
    const viewers = await this.userModel
      .find({ _id: { $in: item.viewedBy } })
      .select('fullName role artistProfile venueProfile')
      .populate('artistProfile', 'profilePhoto stageName')
      .populate('venueProfile', 'profilePhotoUrl name')
      .lean();

    return { viewers, total: viewers.length };
  }
}
