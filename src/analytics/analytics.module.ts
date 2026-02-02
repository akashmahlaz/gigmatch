/// 📊 Analytics Module - NestJS Module for Analytics
///
/// Provides analytics tracking and reporting functionality

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEvent, AnalyticsEventSchema } from './schemas/analytics-event.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Artist, ArtistSchema } from '../artists/schemas/artist.schema';
import { Venue, VenueSchema } from '../venues/schemas/venue.schema';
import { Swipe, SwipeSchema } from '../schemas/swipe.schema';
import { Match, MatchSchema } from '../schemas/match.schema';
import { Message, MessageSchema } from '../schemas/message.schema';
import { Booking, BookingSchema } from '../schemas/booking.schema';
import { Gig, GigSchema } from '../schemas/gig.schema';
import { Review, ReviewSchema } from '../schemas/review.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnalyticsEvent.name, schema: AnalyticsEventSchema },
      { name: User.name, schema: UserSchema },
      { name: Artist.name, schema: ArtistSchema },
      { name: Venue.name, schema: VenueSchema },
      { name: Swipe.name, schema: SwipeSchema },
      { name: Match.name, schema: MatchSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Gig.name, schema: GigSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
