import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { Match, MatchSchema } from '../schemas/match.schema';
import { Artist, ArtistSchema } from '../artists/schemas/artist.schema';
import { Venue, VenueSchema } from '../venues/schemas/venue.schema';
import { Message, MessageSchema } from '../schemas/message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Match.name, schema: MatchSchema },
      { name: Artist.name, schema: ArtistSchema },
      { name: Venue.name, schema: VenueSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
