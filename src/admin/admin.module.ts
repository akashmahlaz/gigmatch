import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, UserSchema } from '../schemas/user.schema';
import { Artist, ArtistSchema } from '../artists/schemas/artist.schema';
import { Venue, VenueSchema } from '../venues/schemas/venue.schema';
import { Match, MatchSchema } from '../schemas/match.schema';
import {
  Subscription,
  SubscriptionSchema,
} from '../schemas/subscription.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Artist.name, schema: ArtistSchema },
      { name: Venue.name, schema: VenueSchema },
      { name: Match.name, schema: MatchSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
