/// 📊 Analytics Controller - REST API for Analytics
///
/// Exposes analytics endpoints for the Flutter app

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /// GET /analytics/profile/views - Get profile view analytics
  @Get('profile/views')
  @ApiOperation({ summary: 'Get profile view analytics' })
  @ApiQuery({ name: 'period', required: false, description: 'Period: day, week, month, year' })
  async getProfileViews(
    @Req() req: any,
    @Query('period') period: string = 'month',
  ): Promise<{ success: boolean; data: any }> {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const dateRange = this.getDateRange(period);
    const data = await this.analyticsService.getProfileViews(userId, dateRange);
    return { success: true, data };
  }

  /// GET /analytics/profile - Get full profile analytics
  @Get('profile')
  @ApiOperation({ summary: 'Get full profile analytics overview' })
  @ApiQuery({ name: 'period', required: false })
  async getProfileAnalytics(
    @Req() req: any,
    @Query('period') period: string = 'month',
  ): Promise<{ success: boolean; data: any }> {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const userType = req.user.role || 'artist';
    const data = await this.analyticsService.getOverview(userId, userType, period);
    return { success: true, data };
  }

  /// GET /analytics/discovery - Get discovery/swipe analytics
  @Get('discovery')
  @ApiOperation({ summary: 'Get discovery analytics (swipes, matches)' })
  @ApiQuery({ name: 'period', required: false })
  async getDiscoveryAnalytics(
    @Req() req: any,
    @Query('period') period: string = 'month',
  ): Promise<{ success: boolean; data: any }> {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const userType = req.user.role || 'artist';
    const dateRange = this.getDateRange(period);
    const data = await this.analyticsService.getDiscoveryAnalytics(userId, userType, dateRange);
    return { success: true, data };
  }

  /// GET /analytics/engagement - Get engagement analytics
  @Get('engagement')
  @ApiOperation({ summary: 'Get engagement analytics (messages, conversations)' })
  @ApiQuery({ name: 'period', required: false })
  async getEngagementAnalytics(
    @Req() req: any,
    @Query('period') period: string = 'month',
  ): Promise<{ success: boolean; data: any }> {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const userType = req.user.role || 'artist';
    const dateRange = this.getDateRange(period);
    const data = await this.analyticsService.getEngagementAnalytics(userId, userType, dateRange);
    return { success: true, data };
  }

  /// GET /analytics/earnings - Get earnings analytics (artists only)
  @Get('earnings')
  @ApiOperation({ summary: 'Get earnings analytics' })
  @ApiQuery({ name: 'period', required: false })
  async getEarningsAnalytics(
    @Req() req: any,
    @Query('period') period: string = 'month',
  ): Promise<{ success: boolean; data: any }> {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const dateRange = this.getDateRange(period);
    const data = await this.analyticsService.getEarningsSummary(userId, dateRange);
    return { success: true, data };
  }

  /// GET /analytics/gigs - Get gig analytics
  @Get('gigs')
  @ApiOperation({ summary: 'Get gig analytics' })
  @ApiQuery({ name: 'period', required: false })
  async getGigAnalytics(
    @Req() req: any,
    @Query('period') period: string = 'month',
  ): Promise<{ success: boolean; data: any }> {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const dateRange = this.getDateRange(period);
    const data = await this.analyticsService.getGigAnalytics(userId, dateRange);
    return { success: true, data };
  }

  /// POST /analytics/export - Export analytics data
  @Post('export')
  @ApiOperation({ summary: 'Export analytics data' })
  async exportAnalytics(
    @Req() req: any,
    @Body() body: { period?: string; format?: string },
  ): Promise<{ success: boolean; data: any; exportedAt: string }> {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const userType = req.user.role || 'artist';
    const overview = await this.analyticsService.getOverview(
      userId,
      userType,
      body.period || 'month',
    );
    return {
      success: true,
      data: overview,
      exportedAt: new Date().toISOString(),
    };
  }

  /// POST /analytics/track - Track an analytics event
  @Post('track')
  @ApiOperation({ summary: 'Track an analytics event' })
  async trackEvent(
    @Req() req: any,
    @Body() body: { eventType: string; data?: Record<string, any> },
  ) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const userType = req.user.role || 'artist';
    
    // Track based on event type
    if (body.eventType === 'profile_view' && body.data?.targetUserId) {
      await this.analyticsService.trackProfileView(
        userId,
        userType,
        body.data.targetUserId,
        body.data.source || 'discovery',
      );
    }
    
    return { success: true };
  }

  /// Helper: Get date range from period string
  private getDateRange(period: string): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    let start: Date;

    switch (period) {
      case 'day':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case 'year':
        start = new Date(now);
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'month':
      default:
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        break;
    }

    return { start, end };
  }
}
