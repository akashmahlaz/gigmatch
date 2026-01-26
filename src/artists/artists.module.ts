import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';
import { Artist, ArtistSchema } from './schemas/artist.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Gig, GigSchema } from '../schemas/gig.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Artist.name, schema: ArtistSchema },
      { name: User.name, schema: UserSchema },
      { name: Gig.name, schema: GigSchema },
    ]),
  ],
  controllers: [ArtistsController],
  providers: [ArtistsService],
  exports: [ArtistsService],
})
export class ArtistsModule {}
