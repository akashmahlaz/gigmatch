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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import {
  CreateBookingDto,
  CancelBookingDto,
  ConfirmPaymentDto,
  UploadContractDto,
  BookingQueryDto,
} from './dto/booking.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
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
    const bookings = await this.bookingsService.findByUser(req.user.userId, query);
    return { bookings };
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
    return this.bookingsService.uploadContract(id, dto.contractUrl, req.user.userId);
  }

  @Post(':id/sign-contract')
  async signContract(@Param('id') id: string, @Request() req) {
    return this.bookingsService.signContract(id, req.user.userId);
  }
}
