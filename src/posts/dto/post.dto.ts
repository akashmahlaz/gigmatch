import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  IsBoolean,
  MaxLength,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class MediaDto {
  @IsEnum(['image', 'video'])
  type: 'image' | 'video';

  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}

class LocationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;
}

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaDto)
  media: MediaDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[]; // User IDs

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @IsOptional()
  @IsBoolean()
  commentsDisabled?: boolean;

  @IsOptional()
  @IsBoolean()
  likesHidden?: boolean;
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @IsOptional()
  @IsBoolean()
  commentsDisabled?: boolean;

  @IsOptional()
  @IsBoolean()
  likesHidden?: boolean;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class CreateCommentDto {
  @IsString()
  @MaxLength(1000)
  text: string;

  @IsOptional()
  @IsString()
  replyToId?: string; // Comment ID to reply to
}

export class FeedQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['trending', 'latest', 'following'])
  sort?: 'trending' | 'latest' | 'following' = 'trending';

  @IsOptional()
  @IsString()
  hashtag?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
