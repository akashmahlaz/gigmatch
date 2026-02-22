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
import { MatchesService } from './matches.service';
import { GetMatchesDto, UpdateMatchDto } from './dto/match.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../schemas/user.schema';

@ApiTags('Matches')
@Controller('matches')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all matches' })
  @ApiResponse({ status: 200, description: 'Matches retrieved' })
  async getMatches(
    @CurrentUser() user: UserPayload,
    @Query() queryDto: GetMatchesDto,
  ) {
    return this.matchesService.getMatches(
      user._id.toString(),
      user.role,
      queryDto,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread matches count' })
  @ApiResponse({ status: 200, description: 'Count returned' })
  async getUnreadCount(@CurrentUser() user: UserPayload) {
    const count = await this.matchesService.getUnreadCount(
      user._id.toString(),
      user.role,
    );
    return { unreadCount: count };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get match by ID' })
  @ApiParam({ name: 'id', description: 'Match ID' })
  @ApiResponse({ status: 200, description: 'Match retrieved' })
  @ApiResponse({ status: 404, description: 'Match not found' })
  async getMatch(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
  ) {
    return this.matchesService.getMatchByIdEnriched(
      id,
      user._id.toString(),
      user.role,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update match (archive/block)' })
  @ApiParam({ name: 'id', description: 'Match ID' })
  @ApiResponse({ status: 200, description: 'Match updated' })
  async updateMatch(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() updateDto: UpdateMatchDto,
  ) {
    return this.matchesService.updateMatch(id, user._id.toString(), updateDto);
  }

  @Post(':id/view')
  @ApiOperation({ summary: 'Mark match as viewed' })
  @ApiParam({ name: 'id', description: 'Match ID' })
  @ApiResponse({ status: 200, description: 'Match marked as viewed' })
  async markAsViewed(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
  ) {
    await this.matchesService.markAsViewed(id, user._id.toString(), user.role);
    return { message: 'Match marked as viewed' };
  }
}
