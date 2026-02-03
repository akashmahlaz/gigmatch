import {
  Body,
  Controller,
  Delete,
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
  ApiBody,
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
  async createGig(@CurrentUser() user: UserPayload, @Body() dto: CreateGigDto) {
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

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a gig (venue only)' })
  @ApiParam({ name: 'id', description: 'Gig ID' })
  @ApiResponse({ status: 200, description: 'Gig deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Gig not found' })
  async deleteGig(
    @CurrentUser() user: UserPayload,
    @Param('id') gigId: string,
  ) {
    if (user.role !== 'venue' && user.role !== 'admin') {
      throw new ForbiddenException('Only venue accounts can delete gigs.');
    }
    await this.gigsService.deleteGig(user._id.toString(), gigId);
    return { message: 'Gig deleted successfully' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a gig (soft delete, venue only)' })
  @ApiParam({ name: 'id', description: 'Gig ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Optional cancellation reason' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Gig cancelled' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Gig not found' })
  async cancelGig(
    @CurrentUser() user: UserPayload,
    @Param('id') gigId: string,
    @Body() body: { reason?: string },
  ) {
    if (user.role !== 'venue' && user.role !== 'admin') {
      throw new ForbiddenException('Only venue accounts can cancel gigs.');
    }
    return this.gigsService.cancelGig(user._id.toString(), gigId, body.reason);
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
  // APPLICATION MANAGEMENT (must be before :id routes)
  // ═══════════════════════════════════════════════════════════════════════

  @Get('my-applications')
  @ApiOperation({ summary: 'Get my gig applications (artist only)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'accepted', 'rejected'],
  })
  @ApiResponse({ status: 200, description: 'Applications returned' })
  async getMyApplications(
    @CurrentUser() user: UserPayload,
    @Query('status') status?: 'pending' | 'accepted' | 'rejected',
  ) {
    if (user.role !== 'artist' && user.role !== 'admin') {
      throw new ForbiddenException('Only artists can view their applications.');
    }
    return this.gigsService.getArtistApplications(user._id.toString(), status);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SHARED ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════

  @Get('discover')
  @ApiOperation({
    summary:
      'Discover gigs for artists (geo + genres). Defaults to artist profile.',
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

  @Get(':id/applications')
  @ApiOperation({ summary: 'Get all applications for a gig (venue only)' })
  @ApiParam({ name: 'id', description: 'Gig ID' })
  @ApiResponse({ status: 200, description: 'Applications returned' })
  @ApiResponse({ status: 403, description: 'Forbidden - not venue owner' })
  async getGigApplications(
    @CurrentUser() user: UserPayload,
    @Param('id') gigId: string,
  ) {
    if (user.role !== 'venue' && user.role !== 'admin') {
      throw new ForbiddenException('Only venues can view applications.');
    }
    return this.gigsService.getGigApplications(user._id.toString(), gigId);
  }

  @Get(':id/application-count')
  @ApiOperation({ summary: 'Get pending application count' })
  @ApiParam({ name: 'id', description: 'Gig ID' })
  async getApplicationCount(@Param('id') gigId: string) {
    const count = await this.gigsService.getApplicationCount(gigId);
    return { pendingApplications: count };
  }

  @Post(':id/create-booking-from-application')
  @ApiOperation({ summary: 'Accept application and create booking' })
  @ApiParam({ name: 'id', description: 'Gig ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['artistId', 'agreedAmount', 'startTime'],
      properties: {
        artistId: { type: 'string', description: 'Artist ID to accept' },
        agreedAmount: { type: 'number', description: 'Final agreed amount' },
        startTime: { type: 'string', description: 'Gig start time' },
        endTime: { type: 'string', description: 'Gig end time (optional)' },
        specialRequests: {
          type: 'string',
          description: 'Any special requests',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Booking created' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async acceptApplicationAndCreateBooking(
    @CurrentUser() user: UserPayload,
    @Param('id') gigId: string,
    @Body()
    body: {
      artistId: string;
      agreedAmount: number;
      startTime: string;
      endTime?: string;
      specialRequests?: string;
    },
  ) {
    if (user.role !== 'venue' && user.role !== 'admin') {
      throw new ForbiddenException('Only venues can accept applications.');
    }
    return this.gigsService.acceptApplicationAndCreateBooking(
      user._id.toString(),
      gigId,
      body.artistId,
      body.agreedAmount,
      body.startTime,
      body.endTime,
      body.specialRequests,
    );
  }

  @Post(':id/decline-application')
  @ApiOperation({ summary: 'Decline an application (venue only)' })
  @ApiParam({ name: 'id', description: 'Gig ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['artistId'],
      properties: {
        artistId: { type: 'string', description: 'Artist ID to decline' },
        reason: {
          type: 'string',
          description: 'Reason for decline (optional)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Application declined' })
  async declineApplication(
    @CurrentUser() user: UserPayload,
    @Param('id') gigId: string,
    @Body() body: { artistId: string; reason?: string },
  ) {
    if (user.role !== 'venue' && user.role !== 'admin') {
      throw new ForbiddenException('Only venues can decline applications.');
    }
    return this.gigsService.declineApplicationByVenue(
      user._id.toString(),
      gigId,
      body.artistId,
      body.reason,
    );
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
    await this.gigsService.declineGig(user._id.toString(), gigId, dto.reason);
    return { message: 'Gig declined' };
  }
}
