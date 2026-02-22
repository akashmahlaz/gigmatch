/// 🔗 GIGMATCH SHARE MODULE
///
/// Provides share pages with OG meta tags for link previews,
/// and .well-known verification files for App Links / Universal Links.
///
/// Routes served OUTSIDE the /api/v1 global prefix.

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';
import { Artist, ArtistSchema } from '../artists/schemas/artist.schema';
import { Venue, VenueSchema } from '../venues/schemas/venue.schema';
import { Post, PostSchema } from '../schemas/post.schema';
import { Gig, GigSchema } from '../schemas/gig.schema';
import { Story, StorySchema } from '../schemas/story.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Artist.name, schema: ArtistSchema },
      { name: Venue.name, schema: VenueSchema },
      { name: Post.name, schema: PostSchema },
      { name: Gig.name, schema: GigSchema },
      { name: Story.name, schema: StorySchema },
    ]),
  ],
  controllers: [ShareController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
