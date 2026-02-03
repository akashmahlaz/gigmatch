/// 📅 GIGMATCH Bookings Controller
///
/// REST API endpoints for booking management
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import {
  CreateBookingDto,
  CancelBookingDto,
  ConfirmPaymentDto,
  UploadContractDto,
  BookingQueryDto,
} from './dto/booking.dto';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ═══════════════════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════════════════

  @Post()
  async create(@Body() dto: CreateBookingDto, @Request() req) {
    return this.bookingsService.create(dto, req.user.userId, req.user.role);
  }

  @Get('me')
  async getMyBookings(@Query() query: BookingQueryDto, @Request() req) {
    const bookings = await this.bookingsService.findByUser(
      req.user.userId,
      query,
    );
    return { bookings };
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming bookings' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Days to look ahead',
  })
  @ApiResponse({ status: 200, description: 'Upcoming bookings returned' })
  async getUpcomingBookings(@Request() req, @Query('days') days?: string) {
    return this.bookingsService.getUpcomingBookings(
      req.user.userId,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get bookings for calendar view' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getCalendarBookings(
    @Request() req,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.bookingsService.getCalendarBookings(
      req.user.userId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.bookingsService.findById(id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  @Post(':id/confirm')
  async confirm(@Param('id') id: string, @Request() req) {
    return this.bookingsService.confirm(id, req.user.userId);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @Request() req,
  ) {
    return this.bookingsService.cancel(id, req.user.userId, dto.reason);
  }

  @Post(':id/complete')
  async markComplete(@Param('id') id: string, @Request() req) {
    return this.bookingsService.markComplete(id, req.user.userId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════

  @Post(':id/pay-deposit')
  async createDepositPayment(@Param('id') id: string, @Request() req) {
    return this.bookingsService.createDepositPaymentIntent(id, req.user.userId);
  }

  @Post(':id/pay-final')
  async createFinalPayment(@Param('id') id: string, @Request() req) {
    return this.bookingsService.createFinalPaymentIntent(id, req.user.userId);
  }

  @Post(':id/confirm-payment')
  async confirmPayment(
    @Param('id') id: string,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.bookingsService.confirmDepositPayment(id, dto.paymentIntentId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONTRACT
  // ═══════════════════════════════════════════════════════════════════════

  @Post(':id/contract')
  async uploadContract(
    @Param('id') id: string,
    @Body() dto: UploadContractDto,
    @Request() req,
  ) {
    return this.bookingsService.uploadContract(
      id,
      dto.contractUrl,
      req.user.userId,
    );
  }

  @Post(':id/sign-contract')
  async signContract(@Param('id') id: string, @Request() req) {
    return this.bookingsService.signContract(id, req.user.userId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATUS ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════

  @Get(':id/contract-status')
  @ApiOperation({ summary: 'Get contract signing status' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Contract status returned' })
  async getContractStatus(@Param('id') id: string, @Request() req) {
    const booking = await this.bookingsService.findById(id);

    // Verify user is part of this booking
    const isArtist = booking.artistUser.toString() === req.user.userId;
    const isVenue = booking.venueUser.toString() === req.user.userId;

    if (!isArtist && !isVenue && req.user.role !== 'admin') {
      throw new ForbiddenException('Not authorized to view this contract.');
    }

    return {
      contractSigned: booking.contractSigned,
      artistSigned: booking.artistSigned || false,
      venueSigned: booking.venueSigned || false,
      bothSigned:
        (booking.artistSigned || false) && (booking.venueSigned || false),
      contractUrl: booking.contractUrl,
      signedAt: booking.contractSignedAt,
    };
  }

  @Get(':id/payment-status')
  @ApiOperation({ summary: 'Get payment status' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  async getPaymentStatus(@Param('id') id: string) {
    const booking = await this.bookingsService.findById(id);

    return {
      depositPaid: booking.payment?.depositPaid || false,
      depositAmount: booking.payment?.depositAmount || 0,
      depositPaidAt: booking.payment?.depositPaidAt,
      finalPaid: booking.payment?.finalPaid || false,
      finalAmount: booking.payment?.finalAmount || booking.agreedAmount * 0.75,
      finalPaidAt: booking.payment?.finalPaidAt,
      stripeDepositId: booking.payment?.stripePaymentIntentId,
      stripeFinalId: booking.payment?.stripeFinalPaymentIntentId,
    };
  }

  @Post(':id/initiate-payment')
  @ApiOperation({ summary: 'Initiate payment for deposit or final' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['paymentType'],
      properties: {
        paymentType: { enum: ['deposit', 'final'] },
      },
    },
  })
  async initiatePayment(
    @Param('id') id: string,
    @Body() body: { paymentType: 'deposit' | 'final' },
    @Request() req,
  ) {
    if (req.user.role !== 'venue' && req.user.role !== 'admin') {
      throw new ForbiddenException('Only venues can initiate payments.');
    }

    if (body.paymentType === 'deposit') {
      return this.bookingsService.createDepositPaymentIntent(
        id,
        req.user.userId,
      );
    } else {
      return this.bookingsService.createFinalPaymentIntent(id, req.user.userId);
    }
  }
}
