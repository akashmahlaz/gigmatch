import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../schemas/user.schema';

import { GigsService } from './gigs.service';
import {
  CreateGigDto,
  UpdateGigDto,
  ApplyToGigDto,
  DeclineGigDto,
  DiscoverGigsDto,
} from './dto/gig.dto';

@ApiTags('Gigs')
@Controller('gigs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GigsController {
  constructor(private readonly gigsService: GigsService) {}

  // ═══════════════════════════════════════════════════════════════════════
  // VENUE ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════

  @Post()
  @ApiOperation({ summary: 'Create a gig (venue only)' })
  @ApiResponse({ status: 201, description: 'Gig created' })
  @ApiResponse({ status: 403, description: 'Forbidden - venue role required' })
  async createGig(
    @CurrentUser() user: UserPayload,
    @Body() dto: CreateGigDto,
  ) {
    if (user.role !== 'venue' && user.role !== 'admin') {
      throw new ForbiddenException('Only venue accounts can create gigs.');
    }
    return this.gigsService.createGig(user._id.toString(), dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a gig (venue only)' })
  @ApiParam({ name: 'id', description: 'Gig ID' })
  @ApiResponse({ status: 200, description: 'Gig updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Gig not found' })
  async updateGig(
    @CurrentUser() user: UserPayload,
    @Param('id') gigId: string,
    @Body() dto: UpdateGigDto,
  ) {
    if (user.role !== 'venue' && user.role !== 'admin') {
      throw new ForbiddenException('Only venue accounts can update gigs.');
    }
    return this.gigsService.updateGig(user._id.toString(), gigId, dto);
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

  // ═══════════════════════════════════════════════════════════════════════
  // SHARED ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════

  @Get('discover')
  @ApiOperation({
    summary: 'Discover gigs for artists (geo + genres). Defaults to artist profile.',
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
    return this.gigsService.discoverGigsForArtist(user._id.toString(), query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a gig by ID' })
  @ApiParam({ name: 'id', description: 'Gig ID' })
  @ApiResponse({ status: 200, description: 'Gig details returned' })
  @ApiResponse({ status: 404, description: 'Gig not found' })
  async getGigById(@Param('id') gigId: string) {
    return this.gigsService.getGigById(gigId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ARTIST ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════

  @Post(':id/apply')
  @ApiOperation({ summary: 'Apply to a gig (artist only)' })
  @ApiParam({ name: 'id', description: 'Gig ID' })
  @ApiResponse({ status: 201, description: 'Application submitted' })
  @ApiResponse({ status: 409, description: 'Already applied' })
  async applyToGig(
    @CurrentUser() user: UserPayload,
    @Param('id') gigId: string,
    @Body() dto: ApplyToGigDto,
  ) {
    if (user.role !== 'artist' && user.role !== 'admin') {
      throw new ForbiddenException('Only artist accounts can apply to gigs.');
    }
    return this.gigsService.applyToGig(user._id.toString(), gigId, dto);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept a gig offer (artist only)' })
  @ApiParam({ name: 'id', description: 'Gig ID' })
  @ApiResponse({ status: 200, description: 'Gig accepted' })
  async acceptGig(
    @CurrentUser() user: UserPayload,
    @Param('id') gigId: string,
  ) {
    if (user.role !== 'artist' && user.role !== 'admin') {
      throw new ForbiddenException('Only artist accounts can accept gigs.');
    }
    return this.gigsService.acceptGig(user._id.toString(), gigId);
  }

  @Post(':id/decline')
  @ApiOperation({ summary: 'Decline a gig offer (artist only)' })
  @ApiParam({ name: 'id', description: 'Gig ID' })
  @ApiResponse({ status: 200, description: 'Gig declined' })
  async declineGig(
    @CurrentUser() user: UserPayload,
    @Param('id') gigId: string,
    @Body() dto: DeclineGigDto,
  ) {
    if (user.role !== 'artist' && user.role !== 'admin') {
      throw new ForbiddenException('Only artist accounts can decline gigs.');
    }
    await this.gigsService.declineGig(
      user._id.toString(),
      gigId,
      dto.reason,
    );
    return { message: 'Gig declined' };
  }
}
