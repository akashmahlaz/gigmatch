/// 🎯 SWIPES & DISCOVERY CONTROLLER
///
/// Handles swipe operations for the Tinder-style discovery system
/// - Artists swipe on gigs/venues
/// - Venues swipe on artists
/// - Match generation based on mutual swipes
/// - Undo swipe functionality

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
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SwipesService } from './swipes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserDocument } from '../auth/schemas/user.schema';
import {
  CreateSwipeDto,
  UndoSwipeDto,
  DiscoverQueryDto,
  SwipeQueryDto,
} from './dto';

@ApiTags('Swipes & Discovery')
@Controller('swipes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SwipesController {
  constructor(private readonly swipesService: SwipesService) {}

  /// ═════════════════════════════════════════════════════════════════════════
  /// SWIPE OPERATIONS
  /// ═════════════════════════════════════════════════════════════════════════

  @Post(':targetId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Swipe on a target (right=like, left=skip)' })
  @ApiResponse({ status: 200, description: 'Swipe recorded successfully' })
  @ApiResponse({ status: 200, description: 'MATCH! - Mutual swipe detected' })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or already swiped',
  })
  async swipe(
    @CurrentUser() user: User,
    @Param('targetId') targetId: string,
    @Body() dto: CreateSwipeDto,
  ) {
    // Use body targetId or param targetId
    const effectiveDto = dto.targetId ? dto : { ...dto, targetId };

    const result = await this.swipesService.swipe(
      user._id.toString(),
      user.role,
      effectiveDto,
    );

    if (result.result === 'match') {
      return {
        success: true,
        action: 'match',
        isMatch: true,
        swipeId: (result.swipe as any)._id?.toString() ?? '',
        message: "🎉 It's a match! You can now start a conversation.",
        match: result.match,
      };
    }

    return {
      success: true,
      isMatch: false,
      swipeId: (result.swipe as any)._id?.toString() ?? '',
      action: result.result === 'liked' ? 'saved' : 'skipped',
      message:
        result.result === 'liked' ? 'Saved to your favorites' : 'Skipped',
      result: result.result,
    };
  }

  @Delete(':swipeId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Undo a swipe' })
  @ApiResponse({ status: 200, description: 'Swipe undone successfully' })
  @ApiResponse({ status: 404, description: 'Swipe not found' })
  async undoSwipe(
    @CurrentUser() user: User,
    @Param('swipeId') swipeId: string,
  ) {
    const dto: UndoSwipeDto = { swipeId };
    await this.swipesService.undoSwipe(user._id.toString(), dto);

    return {
      success: true,
      message: 'Swipe undone successfully',
    };
  }

  /// ═════════════════════════════════════════════════════════════════════════
  /// DISCOVERY FEED
  /// ═════════════════════════════════════════════════════════════════════════

  @Get('discover')
  @ApiOperation({ summary: 'Get discovery feed based on user role' })
  @ApiQuery({
    name: 'latitude',
    required: false,
    description: 'Latitude for location-based discovery',
  })
  @ApiQuery({
    name: 'longitude',
    required: false,
    description: 'Longitude for location-based discovery',
  })
  @ApiQuery({
    name: 'radiusMiles',
    required: false,
    description: 'Radius in miles',
  })
  @ApiQuery({
    name: 'genres',
    required: false,
    description: 'Filter by genres (comma-separated)',
  })
  @ApiQuery({
    name: 'minBudget',
    required: false,
    description: 'Minimum budget',
  })
  @ApiQuery({
    name: 'maxBudget',
    required: false,
    description: 'Maximum budget',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Discovery feed with candidates' })
  async getDiscoveryFeed(
    @CurrentUser() user: User,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('radiusMiles') radiusMiles?: string,
    @Query('genres') genres?: string,
    @Query('minBudget') minBudget?: string,
    @Query('maxBudget') maxBudget?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const query: DiscoverQueryDto = {
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      radiusMiles: radiusMiles ? parseInt(radiusMiles) : undefined,
      genres: genres ? genres.split(',').map((g) => g.trim()) : undefined,
      minBudget: minBudget ? parseFloat(minBudget) : undefined,
      maxBudget: maxBudget ? parseFloat(maxBudget) : undefined,
      dateFrom,
      dateTo,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    };

    let feed;
    if (user.role === 'artist') {
      feed = await this.swipesService.getArtistDiscoveryFeed(
        user._id.toString(),
        query,
      );
    } else {
      feed = await this.swipesService.getVenueDiscoveryFeed(
        user._id.toString(),
        query,
      );
    }

    // Normalize response structure for frontend
    // Backend returns 'gigs' for artists, 'artists' for venues
    // Frontend expects 'profiles' with hasMore for pagination
    const profiles = feed.gigs ?? feed.artists ?? [];
    const pageLimit = query.limit ?? 20;
    const hasMore = feed.total > (feed.page ?? 1) * pageLimit;

    return {
      success: true,
      profiles,
      gigs: feed.gigs,
      artists: feed.artists,
      total: feed.total,
      page: feed.page,
      limit: pageLimit,
      hasMore,
    };
  }

  /// ═════════════════════════════════════════════════════════════════════════
  /// MATCHES & LIKES
  /// ═════════════════════════════════════════════════════════════════════════

  @Get('matches')
  @ApiOperation({ summary: 'Get all matches for current user' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'List of matches' })
  async getMatches(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const matches = await this.swipesService.getMatches(
      user._id.toString(),
      user.role,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );

    return {
      success: true,
      ...matches,
    };
  }

  @Get('who-liked-me')
  @ApiOperation({ summary: 'Get users who swiped right on you' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'List of users who liked you' })
  async getWhoLikedMe(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const likes = await this.swipesService.getWhoLikedMe(
      user._id.toString(),
      user.role,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );

    return {
      success: true,
      ...likes,
    };
  }

  /// ═════════════════════════════════════════════════════════════════════════
  /// SAVED & SKIPPED LISTS
  /// ═════════════════════════════════════════════════════════════════════════

  @Get('saved')
  @ApiOperation({ summary: 'Get all saved/liked profiles' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'List of saved profiles' })
  async getSavedProfiles(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.swipesService.getSavedProfiles(
      user._id.toString(),
      user.role,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );

    return {
      success: true,
      ...result,
    };
  }

  @Get('skipped')
  @ApiOperation({ summary: 'Get all skipped profiles' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'List of skipped profiles' })
  async getSkippedProfiles(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.swipesService.getSkippedProfiles(
      user._id.toString(),
      user.role,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );

    return {
      success: true,
      ...result,
    };
  }

  /// ═════════════════════════════════════════════════════════════════════════
  /// SWIPE HISTORY
  /// ═════════════════════════════════════════════════════════════════════════

  @Get('history')
  @ApiOperation({ summary: 'Get swipe history' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'direction', required: false, enum: ['left', 'right'] })
  @ApiQuery({
    name: 'result',
    required: false,
    enum: ['no_match', 'liked', 'match'],
  })
  @ApiQuery({ name: 'targetType', required: false, enum: ['artist', 'venue'] })
  @ApiResponse({ status: 200, description: 'Swipe history' })
  async getSwipeHistory(
    @CurrentUser() user: User,
    @Query() query: SwipeQueryDto,
  ) {
    const result = await this.swipesService.getSwipeHistory(
      user._id.toString(),
      user.role,
      query,
    );

    return {
      success: true,
      ...result,
    };
  }

  /// ═════════════════════════════════════════════════════════════════════════
  /// SWIPE STATISTICS
  /// ═════════════════════════════════════════════════════════════════════════

  @Get('stats')
  @ApiOperation({ summary: 'Get swipe statistics for current user' })
  @ApiResponse({ status: 200, description: 'Swipe statistics' })
  async getSwipeStats(@CurrentUser() user: User) {
    const stats = await this.swipesService.getSwipeStats(
      user._id.toString(),
      user.role,
    );

    return {
      success: true,
      stats,
    };
  }

  @Get('remaining')
  @ApiOperation({ summary: 'Get remaining swipes for today' })
  @ApiResponse({ status: 200, description: 'Remaining swipe count' })
  async getRemainingSwipes(@CurrentUser() user: User) {
    const remaining = await this.swipesService.getRemainingSwipes(
      user._id.toString(),
      user.role,
    );

    return {
      success: true,
      remaining,
      maxSwipes: user.role === 'artist' ? 100 : 200,
      resetAt: new Date(new Date().setHours(24, 0, 0, 0)),
    };
  }
}
