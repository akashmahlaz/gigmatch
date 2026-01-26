import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SwipesController } from './swipes.controller';
import { SwipesService } from './swipes.service';
import { Swipe, SwipeSchema } from '../schemas/swipe.schema';
import { Match, MatchSchema } from '../schemas/match.schema';
import { Artist, ArtistSchema } from '../artists/schemas/artist.schema';
import { Venue, VenueSchema } from '../venues/schemas/venue.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Subscription, SubscriptionSchema } from '../schemas/subscription.schema';
import { Gig, GigSchema } from '../schemas/gig.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Swipe.name, schema: SwipeSchema },
      { name: Match.name, schema: MatchSchema },
      { name: Artist.name, schema: ArtistSchema },
      { name: Venue.name, schema: VenueSchema },
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Gig.name, schema: GigSchema },
    ]),
  ],
  controllers: [SwipesController],
  providers: [SwipesService],
  exports: [SwipesService],
})
export class SwipesModule {}
