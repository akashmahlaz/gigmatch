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
  ParseUUIDPipe,
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
import { UserPayload } from '../auth/schemas/user.schema';

@ApiTags('Swipes & Discovery')
@Controller('swipes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SwipesController {
  constructor(private readonly swipesService: SwipesService) {}

  /// ═════════════════════════════════════════════════════════════════════════
  /// SWIPE OPERATIONS
  /// ═════════════════════════════════════════════════════════════════════════

  @Post('right/:targetId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Swipe right on a target (save/like)' })
  @ApiResponse({ status: 200, description: 'Swipe recorded' })
  @ApiResponse({ status: 200, description: 'MATCH! - Mutual swipe detected' })
  @ApiResponse({ status: 400, description: 'Already swiped on this target' })
  async swipeRight(
    @CurrentUser() user: UserPayload,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    const result = await this.swipesService.swipeRight(
      user._id.toString(),
      targetId,
    );

    if (result.isMatch) {
      return {
        success: true,
        action: 'match',
        message: "🎉 It's a match! You can now start a conversation.",
        matchId: result.matchId,
        match: result.match,
      };
    }

    return {
      success: true,
      action: 'saved',
      message: 'Saved to your favorites',
    };
  }

  @Post('left/:targetId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Swipe left on a target (skip/pass)' })
  @ApiResponse({ status: 200, description: 'Skip recorded' })
  @ApiResponse({ status: 400, description: 'Already swiped on this target' })
  async swipeLeft(
    @CurrentUser() user: UserPayload,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    await this.swipesService.swipeLeft(user._id.toString(), targetId);

    return {
      success: true,
      action: 'skipped',
      message: 'Skipped',
    };
  }

  @Delete(':targetId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Undo last swipe on a target' })
  @ApiResponse({ status: 200, description: 'Swipe undone' })
  @ApiResponse({ status: 404, description: 'No swipe found to undo' })
  async undoSwipe(
    @CurrentUser() user: UserPayload,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    await this.swipesService.undoSwipe(user._id.toString(), targetId);

    return {
      success: true,
      message: 'Swipe undone',
    };
  }

  /// ═════════════════════════════════════════════════════════════════════════
  /// DISCOVERY FEED
  /// ═════════════════════════════════════════════════════════════════════════

  @Get('discover')
  @ApiOperation({ summary: 'Get discovery feed (swipe candidates)' })
  @ApiQuery({ name: 'latitude', required: false })
  @ApiQuery({ name: 'longitude', required: false })
  @ApiQuery({ name: 'radius', required: false, description: 'Radius in miles' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'List of candidates to swipe on' })
  async getDiscoveryFeed(
    @CurrentUser() user: UserPayload,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('radius') radius?: string,
    @Query('limit') limit?: string,
  ) {
    const params = {
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      radius: radius ? parseInt(radius) : undefined,
      limit: limit ? parseInt(limit) : 10,
    };

    const feed = await this.swipesService.getDiscoveryFeed(
      user._id.toString(),
      params,
    );

    return {
      success: true,
      count: feed.length,
      candidates: feed,
    };
  }

  @Get('who-liked-me')
  @ApiOperation({ summary: 'Get users who swiped right on you' })
  @ApiResponse({ status: 200, description: 'List of users who liked you' })
  async getWhoLikedMe(
    @CurrentUser() user: UserPayload,
    @Query('limit') limit?: string,
  ) {
    const likes = await this.swipesService.getWhoLikedMe(
      user._id.toString(),
      limit ? parseInt(limit) : 20,
    );

    return {
      success: true,
      count: likes.length,
      likes,
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
    @CurrentUser() user: UserPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.swipesService.getSavedProfiles(
      user._id.toString(),
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
    @CurrentUser() user: UserPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.swipesService.getSkippedProfiles(
      user._id.toString(),
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
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
  async getSwipeStats(@CurrentUser() user: UserPayload) {
    const stats = await this.swipesService.getSwipeStats(user._id.toString());

    return {
      success: true,
      stats,
    };
  }

  @Get('remaining')
  @ApiOperation({ summary: 'Get remaining swipes for today' })
  @ApiResponse({ status: 200, description: 'Remaining swipe count' })
  async getRemainingSwipes(@CurrentUser() user: UserPayload) {
    const remaining = await this.swipesService.getRemainingSwipes(
      user._id.toString(),
    );

    return {
      success: true,
      remaining,
      resetAt: new Date(new Date().setHours(24, 0, 0, 0)),
    };
  }
}
