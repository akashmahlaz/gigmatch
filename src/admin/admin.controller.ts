import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { CreateUserDto, UpdateUserDto, QueryUsersDto } from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Dashboard Statistics
  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // User Management
  @Get('users')
  @ApiOperation({ summary: 'Get all users with filters' })
  async getUsers(@Query() query: QueryUsersDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create new user (admin)' })
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.adminService.createUser(createUserDto);
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user' })
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(id, updateUserDto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Post('users/:id/ban')
  @ApiOperation({ summary: 'Ban user' })
  async banUser(@Param('id') id: string) {
    return this.adminService.banUser(id);
  }

  @Post('users/:id/unban')
  @ApiOperation({ summary: 'Unban user' })
  async unbanUser(@Param('id') id: string) {
    return this.adminService.unbanUser(id);
  }

  // Artist Management
  @Get('artists')
  @ApiOperation({ summary: 'Get all artists' })
  async getArtists(@Query() query: any) {
    return this.adminService.getArtists(query);
  }

  @Put('artists/:id')
  @ApiOperation({ summary: 'Update artist profile' })
  async updateArtist(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateArtist(id, data);
  }

  @Delete('artists/:id')
  @ApiOperation({ summary: 'Delete artist' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteArtist(@Param('id') id: string) {
    return this.adminService.deleteArtist(id);
  }

  // Venue Management
  @Get('venues')
  @ApiOperation({ summary: 'Get all venues' })
  async getVenues(@Query() query: any) {
    return this.adminService.getVenues(query);
  }

  @Put('venues/:id')
  @ApiOperation({ summary: 'Update venue profile' })
  async updateVenue(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateVenue(id, data);
  }

  @Delete('venues/:id')
  @ApiOperation({ summary: 'Delete venue' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVenue(@Param('id') id: string) {
    return this.adminService.deleteVenue(id);
  }

  // Matches & Reports
  @Get('matches')
  @ApiOperation({ summary: 'Get all matches' })
  async getMatches(@Query() query: any) {
    return this.adminService.getMatches(query);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get reports and analytics' })
  async getReports(@Query() query: any) {
    return this.adminService.getReports(query);
  }

  // Subscriptions
  @Get('subscriptions')
  @ApiOperation({ summary: 'Get all subscriptions' })
  async getSubscriptions(@Query() query: any) {
    return this.adminService.getSubscriptions(query);
  }
}
