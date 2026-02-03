/// 📅 GIGMATCH Bookings Service
///
/// Business logic for booking management
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Booking, BookingDocument } from '../schemas/booking.schema';
import { Artist, ArtistDocument } from '../artists/schemas/artist.schema';
import { Venue, VenueDocument } from '../venues/schemas/venue.schema';
import { Match, MatchDocument } from '../matches/schemas/match.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBookingDto, BookingQueryDto } from './dto/booking.dto';

@Injectable()
export class BookingsService {
  private stripe: Stripe | null = null;

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Artist.name) private artistModel: Model<ArtistDocument>,
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
  ) {
    const stripeKey = this.configService.get<string>('stripe.secretKey');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2025-12-15.clover',
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BOOKING CRUD
  // ═══════════════════════════════════════════════════════════════════════

  async create(
    dto: CreateBookingDto,
    userId: string,
    _userRole: 'artist' | 'venue',
  ): Promise<Booking> {
    // Get artist and venue
    const artist = await this.artistModel.findById(dto.artistId);
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }

    const venue = await this.venueModel.findById(dto.venueId);
    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    // Verify authorization
    const isArtist = artist.userId.toString() === userId;
    const isVenueOwner = venue.userId.toString() === userId;

    if (!isArtist && !isVenueOwner) {
      throw new ForbiddenException('Not authorized to create this booking');
    }

    // Create booking
    const booking = new this.bookingModel({
      artist: new Types.ObjectId(dto.artistId),
      venue: new Types.ObjectId(dto.venueId),
      artistUser: artist.userId,
      venueUser: venue.userId,
      match: dto.matchId ? new Types.ObjectId(dto.matchId) : undefined,
      gig: dto.gigId ? new Types.ObjectId(dto.gigId) : undefined,
      title: dto.title,
      description: dto.description,
      date: new Date(dto.date),
      startTime: dto.startTime,
      endTime: dto.endTime,
      durationMinutes: dto.durationMinutes || 60,
      numberOfSets: dto.numberOfSets || 1,
      agreedAmount: dto.agreedAmount,
      currency: dto.currency || 'USD',
      payment: {
        depositAmount: dto.depositAmount || dto.agreedAmount * 0.25, // 25% default deposit
        depositPaid: false,
        finalPaid: false,
      },
      specialRequests: dto.specialRequests,
      additionalTerms: dto.additionalTerms,
      status: 'pending',
      // Auto-confirm for the creator
      artistConfirmed: isArtist,
      artistConfirmedAt: isArtist ? new Date() : undefined,
      venueConfirmed: isVenueOwner,
      venueConfirmedAt: isVenueOwner ? new Date() : undefined,
    });

    await booking.save();

    // Send notification to the other party
    const recipientId = isArtist
      ? venue.userId.toString()
      : artist.userId.toString();
    await this.notificationsService.sendNotification({
      userId: recipientId,
      type: 'booking_confirmation',
      title: 'New Booking Request',
      body: `You have a new booking request for "${dto.title}"`,
      deepLink: `/booking/${booking.id}`,
    });

    return booking;
  }

  async findById(bookingId: string): Promise<Booking> {
    const booking = await this.bookingModel
      .findById(bookingId)
      .populate('artist', 'stageName profilePhoto averageRating')
      .populate('venue', 'name profilePhoto averageRating')
      .exec();

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async findByUser(userId: string, query: BookingQueryDto): Promise<Booking[]> {
    const filter: Record<string, unknown> = {
      $or: [
        { artistUser: new Types.ObjectId(userId) },
        { venueUser: new Types.ObjectId(userId) },
      ],
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.upcoming) {
      filter.date = { $gte: new Date() };
      filter.status = { $in: ['pending', 'confirmed', 'deposit_paid'] };
    }

    return this.bookingModel
      .find(filter)
      .populate('artist', 'stageName profilePhoto averageRating')
      .populate('venue', 'name profilePhoto averageRating')
      .sort({ date: query.upcoming ? 1 : -1 })
      .limit(query.limit || 20)
      .skip(query.skip || 0)
      .exec();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BOOKING ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  async confirm(bookingId: string, userId: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    // Check authorization
    const isArtist = booking.artistUser.toString() === userId;
    const isVenueOwner = booking.venueUser.toString() === userId;

    if (!isArtist && !isVenueOwner) {
      throw new ForbiddenException('Not authorized');
    }

    // Update confirmation
    if (isArtist && !booking.artistConfirmed) {
      booking.artistConfirmed = true;
      booking.artistConfirmedAt = new Date();
    } else if (isVenueOwner && !booking.venueConfirmed) {
      booking.venueConfirmed = true;
      booking.venueConfirmedAt = new Date();
    }

    // If both confirmed, update status
    if (booking.artistConfirmed && booking.venueConfirmed) {
      booking.status = 'confirmed';

      // Notify both parties
      await this.notificationsService.sendNotification({
        userId: booking.artistUser.toString(),
        type: 'booking_confirmation',
        title: 'Booking Confirmed!',
        body: `Your booking "${booking.title}" has been confirmed by both parties`,
        deepLink: `/booking/${(booking as BookingDocument).id}`,
      });
      await this.notificationsService.sendNotification({
        userId: booking.venueUser.toString(),
        type: 'booking_confirmation',
        title: 'Booking Confirmed!',
        body: `Your booking "${booking.title}" has been confirmed by both parties`,
        deepLink: `/booking/${(booking as BookingDocument).id}`,
      });
    }

    await (booking as BookingDocument).save();
    return booking;
  }

  async cancel(
    bookingId: string,
    userId: string,
    reason: string,
  ): Promise<Booking> {
    const booking = await this.findById(bookingId);

    // Check authorization
    const isArtist = booking.artistUser.toString() === userId;
    const isVenueOwner = booking.venueUser.toString() === userId;

    if (!isArtist && !isVenueOwner) {
      throw new ForbiddenException('Not authorized');
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      throw new BadRequestException('Cannot cancel this booking');
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancelledBy = isArtist ? 'artist' : 'venue';
    booking.cancellationReason = reason;

    // Handle refund if deposit was paid
    if (booking.payment?.depositPaid && this.stripe) {
      // Implement refund logic based on cancellation policy
      // For now, mark refund as needed
      booking.refundIssued = false;
      booking.refundAmount = booking.payment.depositAmount;
    }

    await (booking as BookingDocument).save();

    // Notify other party
    const recipientId = isArtist
      ? booking.venueUser.toString()
      : booking.artistUser.toString();
    await this.notificationsService.sendNotification({
      userId: recipientId,
      type: 'gig_cancelled',
      title: 'Booking Cancelled',
      body: `The booking "${booking.title}" has been cancelled`,
      deepLink: `/booking/${(booking as BookingDocument).id}`,
    });

    return booking;
  }

  async markComplete(bookingId: string, userId: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    // Check authorization
    const isArtist = booking.artistUser.toString() === userId;
    const isVenueOwner = booking.venueUser.toString() === userId;

    if (!isArtist && !isVenueOwner) {
      throw new ForbiddenException('Not authorized');
    }

    if (!['deposit_paid', 'in_progress'].includes(booking.status)) {
      throw new BadRequestException(
        'Booking cannot be marked complete in current status',
      );
    }

    // Update completion status
    if (isArtist) {
      booking.artistMarkedComplete = true;
    } else {
      booking.venueMarkedComplete = true;
    }

    // If both marked complete, finalize
    if (booking.artistMarkedComplete && booking.venueMarkedComplete) {
      booking.status = 'completed';
      booking.completedAt = new Date();

      // Send review prompt notifications
      await this.notificationsService.sendNotification({
        userId: booking.artistUser.toString(),
        type: 'review_received', // Using existing type for review prompt
        title: 'Leave a Review',
        body: `How was your experience at "${booking.title}"? Leave a review!`,
        deepLink: `/booking/${(booking as BookingDocument).id}`,
      });
      await this.notificationsService.sendNotification({
        userId: booking.venueUser.toString(),
        type: 'review_received',
        title: 'Leave a Review',
        body: `How was the artist performance at "${booking.title}"? Leave a review!`,
        deepLink: `/booking/${(booking as BookingDocument).id}`,
      });
    }

    await (booking as BookingDocument).save();
    return booking;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════

  async createDepositPaymentIntent(
    bookingId: string,
    userId: string,
  ): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
  }> {
    if (!this.stripe) {
      throw new BadRequestException('Payment system not configured');
    }

    const booking = await this.findById(bookingId);

    // Only venue can pay
    if (booking.venueUser.toString() !== userId) {
      throw new ForbiddenException('Only venue can make payment');
    }

    if (booking.status !== 'confirmed') {
      throw new BadRequestException('Booking must be confirmed before payment');
    }

    if (booking.payment?.depositPaid) {
      throw new BadRequestException('Deposit already paid');
    }

    const amount = Math.round(
      (booking.payment?.depositAmount || booking.agreedAmount * 0.25) * 100,
    ); // cents

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency: booking.currency.toLowerCase(),
      metadata: {
        bookingId: (booking as BookingDocument).id,
        type: 'deposit',
      },
    });

    // Store payment intent ID
    booking.payment = {
      ...booking.payment,
      stripePaymentIntentId: paymentIntent.id,
    };
    await (booking as BookingDocument).save();

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      amount: amount / 100,
      currency: booking.currency,
    };
  }

  async confirmDepositPayment(
    bookingId: string,
    paymentIntentId: string,
  ): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.payment?.stripePaymentIntentId !== paymentIntentId) {
      throw new BadRequestException('Payment intent mismatch');
    }

    booking.payment = {
      ...booking.payment,
      depositPaid: true,
      depositPaidAt: new Date(),
    };
    booking.status = 'deposit_paid';

    await (booking as BookingDocument).save();

    // Notify artist about payment
    await this.notificationsService.sendNotification({
      userId: booking.artistUser.toString(),
      type: 'payment_received',
      title: 'Deposit Received!',
      body: `Deposit for "${booking.title}" has been paid. Get ready for the gig!`,
      deepLink: `/booking/${(booking as BookingDocument).id}`,
    });

    return booking;
  }

  /// Create final payment intent (remaining balance after deposit)
  async createFinalPaymentIntent(
    bookingId: string,
    userId: string,
  ): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
  }> {
    if (!this.stripe) {
      throw new BadRequestException('Payment system not configured');
    }

    const booking = await this.findById(bookingId);

    // Only venue can pay
    if (booking.venueUser.toString() !== userId) {
      throw new ForbiddenException('Only venue can make payment');
    }

    if (booking.status !== 'deposit_paid' && booking.status !== 'confirmed') {
      throw new BadRequestException(
        'Booking must have deposit paid or be confirmed',
      );
    }

    if (booking.payment?.finalPaid) {
      throw new BadRequestException('Final payment already completed');
    }

    // Calculate remaining balance (total - deposit)
    const depositAmount =
      booking.payment?.depositAmount || booking.agreedAmount * 0.25;
    const remainingAmount = booking.agreedAmount - depositAmount;
    const amount = Math.round(remainingAmount * 100); // cents

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency: booking.currency.toLowerCase(),
      metadata: {
        bookingId: (booking as BookingDocument).id,
        type: 'final',
      },
    });

    // Store payment intent ID
    booking.payment = {
      ...booking.payment,
      stripeFinalPaymentIntentId: paymentIntent.id,
    };
    await (booking as BookingDocument).save();

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      amount: amount / 100,
      currency: booking.currency,
    };
  }

  /// Confirm final payment
  async confirmFinalPayment(
    bookingId: string,
    paymentIntentId: string,
  ): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.payment?.stripeFinalPaymentIntentId !== paymentIntentId) {
      throw new BadRequestException('Payment intent mismatch');
    }

    booking.payment = {
      ...booking.payment,
      finalPaid: true,
      finalPaidAt: new Date(),
    };
    booking.status = 'paid';

    await (booking as BookingDocument).save();

    // Notify artist about final payment
    await this.notificationsService.sendNotification({
      userId: booking.artistUser.toString(),
      type: 'payment_received',
      title: 'Full Payment Received!',
      body: `Final payment for "${booking.title}" has been completed. Thank you!`,
      deepLink: `/booking/${(booking as BookingDocument).id}`,
    });

    return booking;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONTRACT
  // ═══════════════════════════════════════════════════════════════════════

  async uploadContract(
    bookingId: string,
    contractUrl: string,
    userId: string,
  ): Promise<Booking> {
    const booking = await this.findById(bookingId);

    // Check authorization
    if (
      booking.artistUser.toString() !== userId &&
      booking.venueUser.toString() !== userId
    ) {
      throw new ForbiddenException('Not authorized');
    }

    booking.contractUrl = contractUrl;
    await (booking as BookingDocument).save();

    return booking;
  }

  async signContract(bookingId: string, userId: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    // Check authorization
    const isArtist = booking.artistUser.toString() === userId;
    const isVenueOwner = booking.venueUser.toString() === userId;

    if (!isArtist && !isVenueOwner) {
      throw new ForbiddenException('Not authorized');
    }

    if (!booking.contractUrl) {
      throw new BadRequestException('No contract uploaded');
    }

    // Track which party signed
    if (isArtist && !booking.artistSigned) {
      booking.artistSigned = true;
      booking.artistSignedAt = new Date();
    } else if (isVenueOwner && !booking.venueSigned) {
      booking.venueSigned = true;
      booking.venueSignedAt = new Date();
    }

    // Check if both parties have now signed
    if (booking.artistSigned && booking.venueSigned) {
      booking.contractSigned = true;
      booking.contractSignedAt = new Date();

      // Notify both parties that contract is fully signed
      await this.notificationsService.sendNotification({
        userId: booking.artistUser.toString(),
        type: 'booking_confirmation',
        title: 'Contract Fully Signed!',
        body: `The contract for "${booking.title}" has been signed by both parties.`,
        deepLink: `/booking/${(booking as BookingDocument).id}`,
      });
      await this.notificationsService.sendNotification({
        userId: booking.venueUser.toString(),
        type: 'booking_confirmation',
        title: 'Contract Fully Signed!',
        body: `The contract for "${booking.title}" has been signed by both parties.`,
        deepLink: `/booking/${(booking as BookingDocument).id}`,
      });
    } else {
      // Notify the other party that one has signed
      const recipientId = isArtist
        ? booking.venueUser.toString()
        : booking.artistUser.toString();
      const signerRole = isArtist ? 'artist' : 'venue';

      await this.notificationsService.sendNotification({
        userId: recipientId,
        type: 'booking_confirmation',
        title: 'Contract Signed',
        body: `The ${signerRole} has signed the contract for "${booking.title}". Your signature is needed.`,
        deepLink: `/booking/${(booking as BookingDocument).id}`,
      });
    }

    await (booking as BookingDocument).save();

    return booking;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CALENDAR & UPCOMING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get upcoming bookings for the next N days
   */
  async getUpcomingBookings(userId: string, days: number): Promise<Booking[]> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return this.bookingModel
      .find({
        $or: [
          { artistUser: new Types.ObjectId(userId) },
          { venueUser: new Types.ObjectId(userId) },
        ],
        date: { $gte: new Date(), $lte: endDate },
        status: { $nin: ['cancelled', 'disputed'] },
      })
      .populate('artist', 'stageName profilePhoto averageRating')
      .populate('venue', 'venueName profilePhoto location')
      .sort({ date: 1 })
      .exec();
  }

  /**
   * Get bookings grouped by date for calendar view
   */
  async getCalendarBookings(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Record<string, Booking[]>> {
    const bookings = await this.bookingModel
      .find({
        $or: [
          { artistUser: new Types.ObjectId(userId) },
          { venueUser: new Types.ObjectId(userId) },
        ],
        date: { $gte: startDate, $lte: endDate },
      })
      .populate('artist', 'stageName profilePhoto')
      .populate('venue', 'venueName location')
      .sort({ date: 1, startTime: 1 })
      .exec();

    // Group by date
    const grouped: Record<string, Booking[]> = {};
    for (const booking of bookings) {
      const dateKey = booking.date.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(booking);
    }

    return grouped;
  }

  /**
   * Check if both parties have signed the contract
   */
  async checkContractCompletion(bookingId: string): Promise<boolean> {
    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking) return false;

    return !!(
      booking.contractSigned &&
      booking.artistSigned &&
      booking.venueSigned
    );
  }
}
