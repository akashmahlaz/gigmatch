import { IsEnum, IsOptional, IsString, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSwipeDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsMongoId()
  targetId: string;

  @ApiProperty({ enum: ['artist', 'venue'], description: 'Target type' })
  @IsEnum(['artist', 'venue'])
  targetType: 'artist' | 'venue';

  @ApiProperty({ enum: ['like', 'pass', 'superlike'], description: 'Swipe action' })
  @IsEnum(['like', 'pass', 'superlike'])
  action: 'like' | 'pass' | 'superlike';

  @ApiPropertyOptional({ description: 'Related gig ID (optional)' })
  @IsOptional()
  @IsMongoId()
  relatedGigId?: string;
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
