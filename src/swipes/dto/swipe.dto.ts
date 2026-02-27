/// DTOs for swipe operations
import {
  IsEnum,
  IsOptional,
  IsString,
  IsMongoId,
  IsNumber,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SwipeDirection } from '../schemas/swipe.schema';

export class CreateSwipeDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsMongoId()
  targetId: string;

  @ApiProperty({ enum: ['artist', 'venue'], description: 'Target type' })
  @IsEnum(['artist', 'venue'])
  targetType: 'artist' | 'venue';

  @ApiProperty({ enum: SwipeDirection, description: 'Swipe direction' })
  @IsEnum(SwipeDirection)
  direction: SwipeDirection;

  @ApiPropertyOptional({ description: 'Whether this is a super like (premium feature)' })
  @IsOptional()
  isSuperLike?: boolean;

  @ApiPropertyOptional({ description: 'Related gig ID (optional)' })
  @IsOptional()
  @IsMongoId()
  relatedGigId?: string;

  @ApiPropertyOptional({ description: 'Source of the swipe' })
  @IsOptional()
  @IsString()
  source?: string;
}

export class SwipeResponseDto {
  @ApiProperty()
  swipeId: string;

  @ApiProperty()
  isMatch: boolean;

  @ApiPropertyOptional()
  matchId?: string;

  @ApiPropertyOptional()
  matchedUser?: {
    id: string;
    name: string;
    profilePhoto?: string;
    type: string;
  };
}

export class DiscoveryFiltersDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  genres?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  minBudget?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  venueTypes?: string[];
}

export class SwipeQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by direction',
    enum: SwipeDirection,
  })
  @IsOptional()
  @IsEnum(SwipeDirection)
  direction?: SwipeDirection;

  @ApiPropertyOptional({
    description: 'Filter by swipe type',
    enum: SwipeDirection,
  })
  @IsOptional()
  @IsEnum(SwipeDirection)
  swipeType?: SwipeDirection;

  @ApiPropertyOptional({
    description: 'Filter by result',
    enum: ['no_match', 'liked', 'match'],
  })
  @IsOptional()
  @IsEnum(['no_match', 'liked', 'match'])
  result?: 'no_match' | 'liked' | 'match';

  @ApiPropertyOptional({
    description: 'Filter by target type',
    enum: ['artist', 'venue'],
  })
  @IsOptional()
  @IsEnum(['artist', 'venue'])
  targetType?: 'artist' | 'venue';

  @ApiPropertyOptional({ description: 'Filter by target ID' })
  @IsOptional()
  targetId?: string;
}

export class UndoSwipeDto {
  @ApiProperty({ description: 'Swipe ID to undo' })
  @IsMongoId()
  swipeId: string;

  @ApiPropertyOptional({ description: 'Reason for undo' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DiscoverQueryDto {
  @ApiPropertyOptional({ description: 'Latitude of the user location' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude of the user location' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Latitude (alternative)' })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude (alternative)' })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({
    description: 'Radius in miles to search within',
    default: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusMiles?: number;

  @ApiPropertyOptional({
    description: 'Radius in km (alternative)',
    default: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(800)
  radius?: number;

  @ApiPropertyOptional({ description: 'Minimum budget per gig', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @ApiPropertyOptional({ description: 'Minimum price (alternative)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Maximum budget per gig',
    default: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @ApiPropertyOptional({ description: 'Maximum price (alternative)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Filter by genres', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @ApiPropertyOptional({
    description: 'Start date for gig search',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'End date for gig search',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Exclude these user IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeIds?: string[];

  @ApiPropertyOptional({
    description: 'Enable passport mode (premium only) - removes location restrictions',
    default: false,
  })
  @IsOptional()
  passportMode?: boolean;
}

export class RecommendationScoreDto {
  @ApiProperty({ description: 'User ID being scored' })
  targetId: string;

  @ApiProperty({ description: 'Target user type' })
  targetType: 'artist' | 'venue';

  @ApiProperty({ description: 'Genre match score (0-100)' })
  genreScore: number;

  @ApiProperty({ description: 'Location proximity score (0-100)' })
  locationScore: number;

  @ApiProperty({ description: 'Price compatibility score (0-100)' })
  priceScore: number;

  @ApiProperty({ description: 'Rating/reputation score (0-100)' })
  ratingScore: number;

  @ApiProperty({ description: 'Total recommendation score (0-100)' })
  totalScore: number;

  @ApiProperty({ description: 'Reason codes for the score' })
  reasonCodes: string[];
}
