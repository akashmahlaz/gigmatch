import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { GigsController } from './gigs.controller';
import { GigsService } from './gigs.service';

import { Gig, GigSchema } from '../schemas/gig.schema';
import { Venue, VenueSchema } from '../venues/schemas/venue.schema';
import { Artist, ArtistSchema } from '../artists/schemas/artist.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Booking, BookingSchema } from '../schemas/booking.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Gig.name, schema: GigSchema },
      { name: Venue.name, schema: VenueSchema },
      { name: Artist.name, schema: ArtistSchema },
      { name: User.name, schema: UserSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [GigsController],
  providers: [GigsService],
  exports: [GigsService],
})
export class GigsModule {}
