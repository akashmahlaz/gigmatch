import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SwipesService } from './swipes.service';
import { CreateSwipeDto, DiscoveryFiltersDto } from './dto/swipe.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../schemas/user.schema';

@ApiTags('Swipes & Discovery')
@Controller('swipes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SwipesController {
  constructor(private readonly swipesService: SwipesService) {}

  @Post()
  @ApiOperation({ summary: 'Swipe on a profile (like/pass/superlike)' })
  @ApiResponse({ status: 201, description: 'Swipe recorded' })
  @ApiResponse({ status: 400, description: 'Invalid swipe or already swiped' })
  async swipe(
    @CurrentUser() user: UserPayload,
    @Body() createSwipeDto: CreateSwipeDto,
  ) {
    return this.swipesService.swipe(
      user._id.toString(),
      user.role,
      createSwipeDto,
    );
  }

  @Get('discover')
  @ApiOperation({ summary: 'Get discovery cards (profiles to swipe on)' })
  @ApiQuery({ name: 'genres', required: false, type: [String] })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'minBudget', required: false, type: Number })
  @ApiQuery({ name: 'venueTypes', required: false, type: [String] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Discovery cards returned' })
  async getDiscoveryCards(
    @CurrentUser() user: UserPayload,
    @Query() filters: DiscoveryFiltersDto,
    @Query('limit') limit?: number,
  ) {
    return this.swipesService.getDiscoveryCards(
      user._id.toString(),
      user.role,
      filters,
      limit || 10,
    );
  }

  @Get('who-liked-me')
  @ApiOperation({ summary: 'Get profiles that liked you (premium)' })
  @ApiResponse({ status: 200, description: 'Profiles returned' })
  async getWhoLikedMe(@CurrentUser() user: UserPayload) {
    return this.swipesService.getWhoLikedMe(user._id.toString());
  }

  @Delete('undo')
  @ApiOperation({ summary: 'Undo last swipe (premium)' })
  @ApiResponse({ status: 200, description: 'Swipe undone' })
  @ApiResponse({ status: 400, description: 'Cannot undo' })
  async undoLastSwipe(@CurrentUser() user: UserPayload) {
    await this.swipesService.undoLastSwipe(user._id.toString());
    return { message: 'Last swipe undone' };
  }
}
