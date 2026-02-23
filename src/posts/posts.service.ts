/// 📱 GIGMATCH POSTS SERVICE
///
/// Business logic for Instagram-style posts

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from '../schemas/post.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Match, MatchDocument } from '../schemas/match.schema';
import {
  CreatePostDto,
  UpdatePostDto,
  CreateCommentDto,
  FeedQueryDto,
} from './dto';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE POST
  // ═══════════════════════════════════════════════════════════════════════════

  async create(userId: string, dto: CreatePostDto): Promise<Post> {
    this.logger.log(`posts:create userId=${userId}`);

    // Get user to determine artist/venue profile
    const user = await this.userModel
      .findById(userId)
      .populate('artistProfile')
      .populate('venueProfile');

    if (!user) {
      throw new NotFoundException('User not found');
    }

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

    // Extract hashtags from caption if not provided
    let hashtags = dto.hashtags || [];
    if (dto.caption) {
      const captionHashtags =
        dto.caption.match(/#[\w]+/g)?.map((h) => h.slice(1).toLowerCase()) ||
        [];
      hashtags = [...new Set([...hashtags, ...captionHashtags])];
    }

    // Convert mention strings to ObjectIds
    const mentions = dto.mentions?.map((id) => new Types.ObjectId(id)) || [];

    const post = new this.postModel({
      userId: new Types.ObjectId(userId),
      artistId,
      venueId,
      caption: dto.caption,
      media: dto.media.map((m, i) => ({ ...m, order: m.order ?? i })),
      hashtags,
      mentions,
      locationName: dto.location?.name,
      location:
        dto.location?.longitude && dto.location?.latitude
          ? {
              type: 'Point',
              coordinates: [dto.location.longitude, dto.location.latitude],
            }
          : undefined,
      commentsDisabled: dto.commentsDisabled ?? false,
      likesHidden: dto.likesHidden ?? false,
      trendingScore: 0,
    });

    await post.save();

    return this.findById(post._id.toString(), userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET FEED
  // ═══════════════════════════════════════════════════════════════════════════

  async getFeed(
    userId: string,
    query: FeedQueryDto,
  ): Promise<{ posts: Post[]; hasMore: boolean; total: number }> {
    const { page = 1, limit = 20, sort = 'trending', hashtag } = query;
    const skip = (page - 1) * limit;

    this.logger.log(`posts:feed userId=${userId} page=${page} sort=${sort}`);

    // Build query
    const filter: Record<string, unknown> = { status: 'active' };

    if (hashtag) {
      filter.hashtags = hashtag.toLowerCase();
    }

    if (query.userId) {
      filter.userId = new Types.ObjectId(query.userId);
    }

    // 🚫 Exclude posts from blocked users (bidirectional)
    // Skip when viewing a specific user's profile posts
    if (!query.userId) {
      const blockedUserIds = await this.getBlockedUserIds(userId);
      if (blockedUserIds.length > 0) {
        filter.userId = { $nin: blockedUserIds.map((id) => new Types.ObjectId(id)) };
        this.logger.log(
          `posts:feed excluding ${blockedUserIds.length} blocked user(s) for user ${userId}`,
        );
      }
    }

    // Build sort — boosted posts always come first, then apply user's sort preference
    let sortQuery: Record<string, 1 | -1>;
    switch (sort) {
      case 'trending':
        sortQuery = { isBoosted: -1, trendingScore: -1, createdAt: -1 };
        break;
      case 'latest':
        sortQuery = { isBoosted: -1, createdAt: -1 };
        break;
      case 'following':
        // For now, same as trending. Later: filter by followed users
        sortQuery = { isBoosted: -1, createdAt: -1 };
        break;
      default:
        sortQuery = { isBoosted: -1, trendingScore: -1, createdAt: -1 };
    }

    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort(sortQuery)
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
        .lean(),
      this.postModel.countDocuments(filter),
    ]);

    const hasMore = posts.length > limit;
    const resultPosts = hasMore ? posts.slice(0, limit) : posts;

    // DEBUG: Log the first post's author structure
    if (resultPosts.length > 0) {
      const firstPost = resultPosts[0] as any;
      this.logger.debug(`posts:feed DEBUG - First post author structure:`);
      this.logger.debug(`  userId (raw): ${JSON.stringify(firstPost.userId)}`);
      if (firstPost.userId?.artistProfile) {
        this.logger.debug(`  artistProfile._id: ${firstPost.userId.artistProfile._id}`);
        this.logger.debug(`  artistProfile keys: ${Object.keys(firstPost.userId.artistProfile)}`);
      }
      this.logger.debug(`  post.artistId: ${firstPost.artistId}`);
      this.logger.debug(`  post.venueId: ${firstPost.venueId}`);
    }

    // Add isLiked and isSaved flags for current user
    // Also normalize isBoosted — check expiry
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();
    const enrichedPosts = resultPosts.map((post) => {
      const p = post as any;
      const boostActive = p.isBoosted && p.boostExpiresAt && new Date(p.boostExpiresAt) > now;
      return {
        ...post,
        author: post.userId,
        isBoosted: boostActive,
        isLiked: (post.likes as Types.ObjectId[]).some((id) =>
          id.equals(userObjectId),
        ),
        isSaved: (post.savedBy as Types.ObjectId[]).some((id) =>
          id.equals(userObjectId),
        ),
      };
    });

    return { posts: enrichedPosts as unknown as Post[], hasMore, total };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET SINGLE POST
  // ═══════════════════════════════════════════════════════════════════════════

  async findById(postId: string, userId?: string): Promise<Post> {
    const post = await this.postModel
      .findById(postId)
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
      .populate({
        path: 'comments.userId',
        select: 'fullName role artistProfile venueProfile',
        populate: [
          { path: 'artistProfile', select: 'profilePhoto stageName' },
          { path: 'venueProfile', select: 'profilePhotoUrl name' },
        ],
      })
      .lean();

    if (!post || post.status === 'deleted') {
      throw new NotFoundException('Post not found');
    }

    // Add user-specific flags
    if (userId) {
      const userObjectId = new Types.ObjectId(userId);
      return {
        ...post,
        author: post.userId,
        isLiked: (post.likes as Types.ObjectId[]).some((id) =>
          id.equals(userObjectId),
        ),
        isSaved: (post.savedBy as Types.ObjectId[]).some((id) =>
          id.equals(userObjectId),
        ),
      } as unknown as Post;
    }

    return { ...post, author: post.userId } as unknown as Post;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE POST
  // ═══════════════════════════════════════════════════════════════════════════

  async update(
    postId: string,
    userId: string,
    dto: UpdatePostDto,
  ): Promise<Post> {
    const post = await this.postModel.findById(postId);

    if (!post || post.status === 'deleted') {
      throw new NotFoundException('Post not found');
    }

    if (post.userId.toString() !== userId) {
      throw new ForbiddenException('Cannot edit this post');
    }

    // Extract hashtags from caption if caption is updated
    let hashtags = dto.hashtags;
    if (dto.caption && !dto.hashtags) {
      hashtags =
        dto.caption.match(/#[\w]+/g)?.map((h) => h.slice(1).toLowerCase()) ||
        [];
    }

    Object.assign(post, {
      ...(dto.caption !== undefined && { caption: dto.caption }),
      ...(hashtags && { hashtags }),
      ...(dto.commentsDisabled !== undefined && {
        commentsDisabled: dto.commentsDisabled,
      }),
      ...(dto.likesHidden !== undefined && { likesHidden: dto.likesHidden }),
      ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
    });

    await post.save();
    return this.findById(postId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE POST
  // ═══════════════════════════════════════════════════════════════════════════

  async delete(postId: string, userId: string): Promise<void> {
    const post = await this.postModel.findById(postId);

    if (!post || post.status === 'deleted') {
      throw new NotFoundException('Post not found');
    }

    if (post.userId.toString() !== userId) {
      throw new ForbiddenException('Cannot delete this post');
    }

    post.status = 'deleted';
    await post.save();

    this.logger.log(`posts:deleted postId=${postId} by=${userId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIKE / UNLIKE
  // ═══════════════════════════════════════════════════════════════════════════

  async toggleLike(
    postId: string,
    userId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const userObjectId = new Types.ObjectId(userId);
    const post = await this.postModel.findById(postId);

    if (!post || post.status !== 'active') {
      throw new NotFoundException('Post not found');
    }

    const alreadyLiked = post.likes.some((id) => id.equals(userObjectId));

    if (alreadyLiked) {
      // Unlike
      post.likes = post.likes.filter((id) => !id.equals(userObjectId));
      post.likeCount = Math.max(0, post.likeCount - 1);
    } else {
      // Like
      post.likes.push(userObjectId);
      post.likeCount = post.likeCount + 1;
    }

    // Update trending score
    this.updateTrendingScore(post);

    await post.save();

    return { liked: !alreadyLiked, likeCount: post.likeCount };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE / UNSAVE
  // ═══════════════════════════════════════════════════════════════════════════

  async toggleSave(
    postId: string,
    userId: string,
  ): Promise<{ saved: boolean }> {
    const userObjectId = new Types.ObjectId(userId);
    const post = await this.postModel.findById(postId);

    if (!post || post.status !== 'active') {
      throw new NotFoundException('Post not found');
    }

    const alreadySaved = post.savedBy.some((id) => id.equals(userObjectId));

    if (alreadySaved) {
      post.savedBy = post.savedBy.filter((id) => !id.equals(userObjectId));
    } else {
      post.savedBy.push(userObjectId);
    }

    await post.save();

    return { saved: !alreadySaved };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  async addComment(
    postId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<Post> {
    const post = await this.postModel.findById(postId);

    if (!post || post.status !== 'active') {
      throw new NotFoundException('Post not found');
    }

    if (post.commentsDisabled) {
      throw new BadRequestException('Comments are disabled for this post');
    }

    const comment = {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(userId),
      text: dto.text,
      likes: [],
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    post.comments.push(comment as never);
    post.commentCount = post.comments.length;

    // Update trending score
    this.updateTrendingScore(post);

    await post.save();

    return this.findById(postId, userId);
  }

  async deleteComment(
    postId: string,
    commentId: string,
    userId: string,
  ): Promise<Post> {
    const post = await this.postModel.findById(postId);

    if (!post || post.status !== 'active') {
      throw new NotFoundException('Post not found');
    }

    const commentIndex = post.comments.findIndex(
      (c) => (c as unknown as { _id: Types.ObjectId })._id.toString() === commentId,
    );

    if (commentIndex === -1) {
      throw new NotFoundException('Comment not found');
    }

    const comment = post.comments[commentIndex];

    // Check if user owns the comment or the post
    if (
      comment.userId.toString() !== userId &&
      post.userId.toString() !== userId
    ) {
      throw new ForbiddenException('Cannot delete this comment');
    }

    post.comments.splice(commentIndex, 1);
    post.commentCount = post.comments.length;

    await post.save();

    return this.findById(postId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER'S POSTS
  // ═══════════════════════════════════════════════════════════════════════════

  async getUserPosts(
    targetUserId: string,
    currentUserId: string,
    page = 1,
    limit = 20,
  ): Promise<{ posts: Post[]; hasMore: boolean; total: number }> {
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.postModel
        .find({ userId: new Types.ObjectId(targetUserId), status: 'active' })
        .sort({ isPinned: -1, createdAt: -1 })
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
        .lean(),
      this.postModel.countDocuments({
        userId: new Types.ObjectId(targetUserId),
        status: 'active',
      }),
    ]);

    const hasMore = posts.length > limit;
    const resultPosts = hasMore ? posts.slice(0, limit) : posts;

    const userObjectId = new Types.ObjectId(currentUserId);
    const enrichedPosts = resultPosts.map((post) => ({
      ...post,
      author: post.userId,
      isLiked: (post.likes as Types.ObjectId[]).some((id) =>
        id.equals(userObjectId),
      ),
      isSaved: (post.savedBy as Types.ObjectId[]).some((id) =>
        id.equals(userObjectId),
      ),
    }));

    return { posts: enrichedPosts as unknown as Post[], hasMore, total };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRENDING SCORE CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  private updateTrendingScore(post: PostDocument): void {
    // Weighted score: likes + comments*2 + shares*3 + views*0.01
    // Time decay: score * (1 / (hours_since_post + 2)^1.5)
    const hoursSincePost =
      (Date.now() - new Date(post['createdAt']).getTime()) / (1000 * 60 * 60);

    const rawScore =
      post.likeCount +
      post.commentCount * 2 +
      post.shareCount * 3 +
      post.viewCount * 0.01;

    // Time decay factor
    const decayFactor = 1 / Math.pow(hoursSincePost + 2, 1.5);

    post.trendingScore = Math.round(rawScore * decayFactor * 1000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INCREMENT VIEW COUNT
  // ═══════════════════════════════════════════════════════════════════════════

  async incrementViewCount(postId: string): Promise<void> {
    await this.postModel.updateOne(
      { _id: new Types.ObjectId(postId) },
      { $inc: { viewCount: 1 } },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOST POST (Premium Feature)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Boost a post for 24 hours. Requires pro/premium subscription.
   * Boosted posts appear at the top of all feeds.
   */
  async boostPost(postId: string, userId: string): Promise<Post> {
    this.logger.log(`posts:boost postId=${postId} userId=${userId}`);

    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId.toString() !== userId) {
      throw new ForbiddenException('You can only boost your own posts');
    }

    if (post.status !== 'active') {
      throw new BadRequestException('Can only boost active posts');
    }

    // Check subscription tier
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tier = user.subscriptionTier || 'free';
    if (tier === 'free') {
      throw new ForbiddenException('Boosting posts requires a Pro or Premium subscription');
    }

    // Check if already boosted and not expired
    if (post.isBoosted && post.boostExpiresAt && post.boostExpiresAt > new Date()) {
      throw new BadRequestException(
        `Post is already boosted until ${post.boostExpiresAt.toISOString()}`,
      );
    }

    // Boost duration: 24 hours for pro, 48 hours for premium
    const boostHours = tier === 'premium' ? 48 : 24;
    const boostExpiresAt = new Date(Date.now() + boostHours * 60 * 60 * 1000);

    post.isBoosted = true;
    post.boostExpiresAt = boostExpiresAt;
    await post.save();

    this.logger.log(
      `Post ${postId} boosted by ${userId} (tier=${tier}) until ${boostExpiresAt.toISOString()}`,
    );

    return this.findById(postId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCK HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get user IDs that the current user has blocked or been blocked by
   */
  private async getBlockedUserIds(userId: string): Promise<string[]> {
    const blockedMatches = await this.matchModel
      .find({
        status: 'blocked',
        $or: [{ artistUser: userId }, { venueUser: userId }],
      })
      .select('artistUser venueUser')
      .lean();

    return blockedMatches.map((m) =>
      m.artistUser.toString() === userId
        ? m.venueUser.toString()
        : m.artistUser.toString(),
    );
  }
}
