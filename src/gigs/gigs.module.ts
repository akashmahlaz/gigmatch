import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { GigsController } from './gigs.controller';
import { GigsService } from './gigs.service';

import { Gig, GigSchema } from '../schemas/gig.schema';
import { Venue, VenueSchema } from '../schemas/venue.schema';
import { Artist, ArtistSchema } from '../schemas/artist.schema';
import { User, UserSchema } from '../schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Gig.name, schema: GigSchema },
      { name: Venue.name, schema: VenueSchema },
      { name: Artist.name, schema: ArtistSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [GigsController],
  providers: [GigsService],
  exports: [GigsService],
})
export class GigsModule {}
