/// 📖 GIGMATCH STORIES CONTROLLER
///
/// REST API endpoints for 24-hour ephemeral stories

import {
  Controller,
  Get,
  Post,
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
import { StoriesService } from './stories.service';
import {
  CreateStoryDto,
  AddStoryItemDto,
  ReactToStoryDto,
  StoriesQueryDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../schemas/user.schema';

@ApiTags('Stories')
@Controller('stories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // FEED
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('feed')
  @ApiOperation({ summary: 'Get stories feed' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Stories feed retrieved' })
  async getFeed(@CurrentUser() user: UserPayload, @Query() query: StoriesQueryDto) {
    return this.storiesService.getFeed(user._id.toString(), query);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @ApiOperation({ summary: 'Create a new story' })
  @ApiResponse({ status: 201, description: 'Story created' })
  async create(@CurrentUser() user: UserPayload, @Body() dto: CreateStoryDto) {
    return this.storiesService.create(user._id.toString(), dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET SINGLE STORY
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':id')
  @ApiOperation({ summary: 'Get a single story by ID' })
  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({ status: 200, description: 'Story retrieved' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async getById(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.storiesService.findById(id, user._id.toString());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET USER'S STORY
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('user/:userId')
  @ApiOperation({ summary: "Get a user's active story" })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Story retrieved (or null if none)' })
  async getUserStory(
    @CurrentUser() user: UserPayload,
    @Param('userId') userId: string,
  ) {
    return this.storiesService.getUserStory(userId, user._id.toString());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADD ITEM TO STORY
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/items')
  @ApiOperation({ summary: 'Add an item to existing story' })
  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({ status: 201, description: 'Item added' })
  async addItem(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: AddStoryItemDto,
  ) {
    return this.storiesService.addItem(id, user._id.toString(), dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MARK VIEWED
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/items/:itemId/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a story item as viewed' })
  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  @ApiResponse({ status: 204, description: 'Marked as viewed' })
  async markViewed(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.storiesService.markViewed(id, itemId, user._id.toString());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REACT TO ITEM
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/react')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'React to a story item with emoji' })
  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({ status: 204, description: 'Reaction added' })
  async react(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: ReactToStoryDto,
  ) {
    return this.storiesService.reactToItem(id, user._id.toString(), dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE STORY
  // ═══════════════════════════════════════════════════════════════════════════

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a story' })
  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({ status: 204, description: 'Story deleted' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async delete(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.storiesService.delete(id, user._id.toString());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE ITEM
  // ═══════════════════════════════════════════════════════════════════════════

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Delete a story item' })
  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  @ApiResponse({ status: 200, description: 'Item deleted, updated story returned' })
  async deleteItem(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.storiesService.deleteItem(id, itemId, user._id.toString());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET VIEWERS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':id/items/:itemId/viewers')
  @ApiOperation({ summary: 'Get viewers of a story item (owner only)' })
  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  @ApiResponse({ status: 200, description: 'Viewers list' })
  @ApiResponse({ status: 403, description: 'Not story owner' })
  async getViewers(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.storiesService.getViewers(id, itemId, user._id.toString());
  }
}
