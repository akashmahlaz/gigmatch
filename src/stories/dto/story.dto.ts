import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  MaxLength,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class StoryItemDto {
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
  duration?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsString()
  linkText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];
}

export class CreateStoryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoryItemDto)
  items: StoryItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  expiryHours?: number; // Default 24 hours
}

export class AddStoryItemDto extends StoryItemDto {}

export class ReactToStoryDto {
  @IsString()
  itemId: string;

  @IsString()
  @MaxLength(10)
  emoji: string;
}

export class StoriesQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  userId?: string;
}
