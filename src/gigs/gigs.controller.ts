import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../schemas/user.schema';

import { GigsService } from './gigs.service';
import { CreateGigDto, DiscoverGigsDto } from './dto/gig.dto';

@ApiTags('Gigs')
@Controller('gigs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GigsController {
  constructor(private readonly gigsService: GigsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a gig (venue only)' })
  @ApiResponse({ status: 201, description: 'Gig created' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createGig(
    @CurrentUser() user: UserPayload,
    @Body() dto: CreateGigDto,
  ) {
    // Service enforces ownership + permissions, but we keep controller intent clear.
    if (user.role !== 'venue' && user.role !== 'admin') {
      // Using ForbiddenException would be ideal, but keeping logic centralized in service.
      // The service will throw if user is not allowed.
    }
    return this.gigsService.createGig(user._id.toString(), dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get my gigs (venue only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Venue gigs returned' })
  async getMyGigs(
    @CurrentUser() user: UserPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.gigsService.getVenueGigs(user._id.toString(), {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status: status || undefined,
    });
  }

  @Get('discover')
  @ApiOperation({
    summary:
      'Discover gigs for artists (geo radius + genres). Defaults to artist profile when omitted.',
  })
  @ApiQuery({ name: 'genres', required: false, type: [String] })
  @ApiQuery({ name: 'latitude', required: false, type: Number })
  @ApiQuery({ name: 'longitude', required: false, type: Number })
  @ApiQuery({ name: 'radiusKm', required: false, type: Number })
  @ApiQuery({ name: 'minBudget', required: false, type: Number })
  @ApiQuery({ name: 'maxBudget', required: false, type: Number })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['relevance', 'date', 'budget', 'distance', 'newest'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Gig discovery feed returned' })
  async discoverGigs(
    @CurrentUser() user: UserPayload,
    @Query() query: DiscoverGigsDto,
  ) {
    // Artist-first endpoint. If venue hits it, we still return results only if
    // service decides to allow later. For now, service will require artist profile.
    return this.gigsService.discoverGigsForArtist(user._id.toString(), query);
  }
}
