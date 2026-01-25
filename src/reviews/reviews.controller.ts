import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import {
  CreateReviewDto,
  RespondToReviewDto,
  GetReviewsQueryDto,
} from './dto/review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserPayload } from '../schemas/user.schema';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * Create a review after completed gig
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review for a completed gig' })
  @ApiResponse({ status: 201, description: 'Review created' })
  @ApiResponse({ status: 400, description: 'Gig not completed or already reviewed' })
  @ApiResponse({ status: 403, description: 'Not part of this gig' })
  async createReview(
    @CurrentUser() user: UserPayload,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(user._id.toString(), dto);
  }

  /**
   * Get reviews for an artist (public)
   */
  @Public()
  @Get('artist/:artistId')
  @ApiOperation({ summary: 'Get reviews for an artist' })
  @ApiParam({ name: 'artistId', description: 'Artist ID' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['newest', 'oldest', 'highest', 'lowest', 'helpful'] })
  @ApiQuery({ name: 'rating', required: false })
  @ApiResponse({ status: 200, description: 'Reviews retrieved' })
  async getArtistReviews(
    @Param('artistId') artistId: string,
    @Query() query: GetReviewsQueryDto,
  ) {
    return this.reviewsService.getArtistReviews(artistId, query);
  }

  /**
   * Get review stats for an artist (public)
   */
  @Public()
  @Get('artist/:artistId/stats')
  @ApiOperation({ summary: 'Get review statistics for an artist' })
  @ApiParam({ name: 'artistId', description: 'Artist ID' })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  async getArtistStats(@Param('artistId') artistId: string) {
    return this.reviewsService.getReviewStats(artistId, 'Artist');
  }

  /**
   * Get reviews for a venue (public)
   */
  @Public()
  @Get('venue/:venueId')
  @ApiOperation({ summary: 'Get reviews for a venue' })
  @ApiParam({ name: 'venueId', description: 'Venue ID' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['newest', 'oldest', 'highest', 'lowest', 'helpful'] })
  @ApiQuery({ name: 'rating', required: false })
  @ApiResponse({ status: 200, description: 'Reviews retrieved' })
  async getVenueReviews(
    @Param('venueId') venueId: string,
    @Query() query: GetReviewsQueryDto,
  ) {
    return this.reviewsService.getVenueReviews(venueId, query);
  }

  /**
   * Get review stats for a venue (public)
   */
  @Public()
  @Get('venue/:venueId/stats')
  @ApiOperation({ summary: 'Get review statistics for a venue' })
  @ApiParam({ name: 'venueId', description: 'Venue ID' })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  async getVenueStats(@Param('venueId') venueId: string) {
    return this.reviewsService.getReviewStats(venueId, 'Venue');
  }

  /**
   * Get my written reviews
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reviews I have written' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'My reviews retrieved' })
  async getMyReviews(
    @CurrentUser() user: UserPayload,
    @Query() query: GetReviewsQueryDto,
  ) {
    return this.reviewsService.getMyReviews(user._id.toString(), query);
  }

  /**
   * Respond to a review about you
   */
  @UseGuards(JwtAuthGuard)
  @Put(':reviewId/respond')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Respond to a review' })
  @ApiParam({ name: 'reviewId', description: 'Review ID' })
  @ApiResponse({ status: 200, description: 'Response added' })
  @ApiResponse({ status: 403, description: 'Not your review to respond to' })
  async respondToReview(
    @CurrentUser() user: UserPayload,
    @Param('reviewId') reviewId: string,
    @Body() dto: RespondToReviewDto,
  ) {
    return this.reviewsService.respondToReview(
      user._id.toString(),
      reviewId,
      dto,
    );
  }

  /**
   * Mark review as helpful
   */
  @UseGuards(JwtAuthGuard)
  @Post(':reviewId/helpful')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle helpful mark on a review' })
  @ApiParam({ name: 'reviewId', description: 'Review ID' })
  @ApiResponse({ status: 200, description: 'Helpful toggled' })
  async markHelpful(
    @CurrentUser() user: UserPayload,
    @Param('reviewId') reviewId: string,
  ) {
    await this.reviewsService.markHelpful(user._id.toString(), reviewId);
    return { success: true };
  }
}
