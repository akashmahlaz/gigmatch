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
  ApiQuery,
} from '@nestjs/swagger';
import { ArtistsService } from './artists.service';
import { UpdateArtistDto, SearchArtistsDto } from './dto/artist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
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
  @ApiOperation({ summary: 'Complete profile setup' })
  @ApiResponse({ status: 200, description: 'Setup completed' })
  async completeSetup(@CurrentUser() user: UserPayload) {
    return this.artistsService.completeSetup(user._id.toString());
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Post('me/boost')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Boost artist profile for visibility' })
  @ApiQuery({ name: 'hours', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Profile boosted' })
  async boostProfile(
    @CurrentUser() user: UserPayload,
    @Query('hours') hours?: number,
  ) {
    return this.artistsService.boostProfile(user._id.toString(), hours);
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
