import {
  Controller,
  Get,
  Put,
  Post,
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
} from '@nestjs/swagger';
import { VenuesService } from './venues.service';
import { UpdateVenueDto, SearchVenuesDto } from './dto/venue.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserPayload } from '../schemas/user.schema';

@ApiTags('Venues')
@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search venues with filters' })
  @ApiResponse({ status: 200, description: 'Venues found' })
  async search(@Query() searchDto: SearchVenuesDto) {
    return this.venuesService.search(searchDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current venue profile' })
  @ApiResponse({ status: 200, description: 'Venue profile retrieved' })
  async getMyProfile(@CurrentUser() user: UserPayload) {
    return this.venuesService.findByUserId(user._id.toString());
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('venue')
  @Put('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current venue profile' })
  @ApiResponse({ status: 200, description: 'Venue profile updated' })
  async updateMyProfile(
    @CurrentUser() user: UserPayload,
    @Body() updateVenueDto: UpdateVenueDto,
  ) {
    return this.venuesService.update(user._id.toString(), updateVenueDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('venue')
  @Post('me/complete-setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete venue profile setup with optional updates' })
  @ApiResponse({ status: 200, description: 'Setup completed' })
  async completeSetup(
    @CurrentUser() user: UserPayload,
    @Body() updateVenueDto?: UpdateVenueDto,
  ) {
    return this.venuesService.completeSetup(user._id.toString(), updateVenueDto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get public venue profile by ID' })
  @ApiParam({ name: 'id', description: 'Venue ID' })
  @ApiResponse({ status: 200, description: 'Venue profile retrieved' })
  @ApiResponse({ status: 404, description: 'Venue not found' })
  async getPublicProfile(@Param('id') id: string) {
    return this.venuesService.findPublicProfile(id);
  }
}
