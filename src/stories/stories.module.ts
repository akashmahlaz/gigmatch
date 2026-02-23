/// 📖 GIGMATCH STORIES MODULE
///
/// 24-hour ephemeral stories feature module

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { Story, StorySchema } from '../schemas/story.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Match, MatchSchema } from '../schemas/match.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: User.name, schema: UserSchema },
      { name: Match.name, schema: MatchSchema },
    ]),
  ],
  controllers: [StoriesController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}
