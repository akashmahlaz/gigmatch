/// 📱 GIGMATCH POSTS CONTROLLER
///
/// REST API endpoints for Instagram-style posts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import {
  CreatePostDto,
  UpdatePostDto,
  CreateCommentDto,
  FeedQueryDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../schemas/user.schema';

@ApiTags('Posts')
@Controller('posts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // FEED
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('feed')
  @ApiOperation({ summary: 'Get posts feed' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sort', required: false, enum: ['trending', 'latest', 'following'] })
  @ApiQuery({ name: 'hashtag', required: false })
  @ApiResponse({ status: 200, description: 'Feed retrieved' })
  async getFeed(@CurrentUser() user: UserPayload, @Query() query: FeedQueryDto) {
    return this.postsService.getFeed(user._id.toString(), query);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, description: 'Post created' })
  async create(@CurrentUser() user: UserPayload, @Body() dto: CreatePostDto) {
    return this.postsService.create(user._id.toString(), dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET SINGLE POST
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':id')
  @ApiOperation({ summary: 'Get a single post by ID' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Post retrieved' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async getById(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    // Increment view count
    this.postsService.incrementViewCount(id);
    return this.postsService.findById(id, user._id.toString());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════════════════════════

  @Put(':id')
  @ApiOperation({ summary: 'Update a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Post updated' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, user._id.toString(), dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════════════════════

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 204, description: 'Post deleted' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async delete(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.postsService.delete(id, user._id.toString());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIKE / UNLIKE
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/like')
  @ApiOperation({ summary: 'Toggle like on a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Like toggled' })
  async toggleLike(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.postsService.toggleLike(id, user._id.toString());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE / UNSAVE
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/save')
  @ApiOperation({ summary: 'Toggle save on a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Save toggled' })
  async toggleSave(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.postsService.toggleSave(id, user._id.toString());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 201, description: 'Comment added' })
  @ApiResponse({ status: 400, description: 'Comments disabled' })
  async addComment(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.postsService.addComment(id, user._id.toString(), dto);
  }

  @Delete(':id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiParam({ name: 'commentId', description: 'Comment ID' })
  @ApiResponse({ status: 204, description: 'Comment deleted' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async deleteComment(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ) {
    return this.postsService.deleteComment(id, commentId, user._id.toString());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER'S POSTS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('user/:userId')
  @ApiOperation({ summary: "Get a user's posts" })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Posts retrieved' })
  async getUserPosts(
    @CurrentUser() user: UserPayload,
    @Param('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.postsService.getUserPosts(
      userId,
      user._id.toString(),
      Number(page),
      Number(limit),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOST POST (Premium Feature)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/boost')
  @ApiOperation({ summary: 'Boost a post to the top of feeds (Pro/Premium only)' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Post boosted successfully' })
  @ApiResponse({ status: 403, description: 'Requires Pro or Premium subscription' })
  async boostPost(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    const post = await this.postsService.boostPost(id, user._id.toString());
    return {
      success: true,
      message: 'Post boosted successfully',
      post,
    };
  }
}
