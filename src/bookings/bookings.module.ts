/// 📅 GIGMATCH Bookings Module
///
/// NestJS module for booking management between artists and venues
/// Features:
/// - Booking creation and management
/// - Payment integration (Stripe)
/// - Contract handling
/// - Completion flow

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking, BookingSchema } from '../schemas/booking.schema';
import { Artist, ArtistSchema } from '../artists/schemas/artist.schema';
import { Venue, VenueSchema } from '../venues/schemas/venue.schema';
import { Match, MatchSchema } from '../matches/schemas/match.schema';
import { Gig, GigSchema } from '../gigs/schemas/gig.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Artist.name, schema: ArtistSchema },
      { name: Venue.name, schema: VenueSchema },
      { name: Match.name, schema: MatchSchema },
      { name: Gig.name, schema: GigSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
