import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
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
import { ArtistsService } from './artists.service';
import { UpdateArtistDto, SearchArtistsDto } from './dto/artist.dto';
import {
  UpdateAvailabilityDto,
  AddAvailabilityDto,
  RemoveAvailabilityDto,
  GetAvailabilityQueryDto,
} from './dto/calendar.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireSubscription } from '../auth/decorators/subscription.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserPayload } from '../schemas/user.schema';

@ApiTags('Artists')
@Controller('artists')
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search artists with filters' })
  @ApiResponse({ status: 200, description: 'Artists found' })
  async search(@Query() searchDto: SearchArtistsDto) {
    return this.artistsService.search(searchDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current artist profile' })
  @ApiResponse({ status: 200, description: 'Artist profile retrieved' })
  async getMyProfile(@CurrentUser() user: UserPayload) {
    return this.artistsService.findByUserId(user._id.toString());
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Put('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current artist profile' })
  @ApiResponse({ status: 200, description: 'Artist profile updated' })
  async updateMyProfile(
    @CurrentUser() user: UserPayload,
    @Body() updateArtistDto: UpdateArtistDto,
  ) {
    return this.artistsService.update(user._id.toString(), updateArtistDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Post('me/complete-setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete profile setup with optional updates' })
  @ApiResponse({ status: 200, description: 'Setup completed' })
  async completeSetup(
    @CurrentUser() user: UserPayload,
    @Body() updateArtistDto?: UpdateArtistDto,
  ) {
    return this.artistsService.completeSetup(user._id.toString(), updateArtistDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles('artist')
  @RequireSubscription('pro')
  @Post('me/boost')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Boost artist profile for visibility (requires Pro+)' })
  @ApiQuery({ name: 'hours', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Profile boosted' })
  @ApiResponse({ status: 403, description: 'Requires Pro subscription' })
  async boostProfile(
    @CurrentUser() user: UserPayload,
    @Query('hours') hours?: number,
  ) {
    return this.artistsService.boostProfile(user._id.toString(), hours);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📅 CALENDAR / AVAILABILITY ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Get('me/calendar')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get artist calendar with availability and booked gigs' })
  @ApiResponse({ status: 200, description: 'Calendar data retrieved' })
  async getCalendar(
    @CurrentUser() user: UserPayload,
    @Query() query: GetAvailabilityQueryDto,
  ) {
    return this.artistsService.getCalendar(user._id.toString(), query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Get('me/availability')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get artist availability slots' })
  @ApiResponse({ status: 200, description: 'Availability retrieved' })
  async getAvailability(
    @CurrentUser() user: UserPayload,
    @Query() query: GetAvailabilityQueryDto,
  ) {
    return this.artistsService.getAvailability(user._id.toString(), query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Put('me/availability')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace all availability slots' })
  @ApiResponse({ status: 200, description: 'Availability updated' })
  async updateAvailability(
    @CurrentUser() user: UserPayload,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.artistsService.updateAvailability(user._id.toString(), dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Post('me/availability')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a single availability slot' })
  @ApiResponse({ status: 201, description: 'Availability slot added' })
  async addAvailabilitySlot(
    @CurrentUser() user: UserPayload,
    @Body() dto: AddAvailabilityDto,
  ) {
    return this.artistsService.addAvailabilitySlot(user._id.toString(), dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Delete('me/availability')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove availability for a specific date' })
  @ApiResponse({ status: 200, description: 'Availability removed' })
  async removeAvailability(
    @CurrentUser() user: UserPayload,
    @Body() dto: RemoveAvailabilityDto,
  ) {
    return this.artistsService.removeAvailability(user._id.toString(), dto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get public artist profile by ID' })
  @ApiParam({ name: 'id', description: 'Artist ID' })
  @ApiResponse({ status: 200, description: 'Artist profile retrieved' })
  @ApiResponse({ status: 404, description: 'Artist not found' })
  async getPublicProfile(@Param('id') id: string) {
    return this.artistsService.findPublicProfile(id);
  }
}
