import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsMongoId,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ description: 'ID of the gig being reviewed' })
  @IsMongoId()
  gigId: string;

  @ApiProperty({ description: 'Overall rating 1-5', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  overallRating: number;

  @ApiPropertyOptional({ description: 'Performance quality rating 1-5' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  performanceRating?: number;

  @ApiPropertyOptional({ description: 'Professionalism rating 1-5' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  professionalismRating?: number;

  @ApiPropertyOptional({ description: 'Reliability rating 1-5' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  reliabilityRating?: number;

  @ApiPropertyOptional({ description: 'Venue quality rating 1-5 (for venue reviews)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  venueQualityRating?: number;

  @ApiPropertyOptional({ description: 'Payment promptness rating 1-5 (for venue reviews)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  paymentRating?: number;

  @ApiProperty({ description: 'Review content', minLength: 10, maxLength: 1000 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  content: string;

  @ApiPropertyOptional({ description: 'Tags like great-sound, professional' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Photo URLs from the gig' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}

export class RespondToReviewDto {
  @ApiProperty({ description: 'Response content', minLength: 10, maxLength: 500 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  response: string;
}

export class GetReviewsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ description: 'Sort by', enum: ['newest', 'oldest', 'highest', 'lowest', 'helpful'] })
  @IsOptional()
  @IsString()
  sortBy?: 'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful';

  @ApiPropertyOptional({ description: 'Filter by rating' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;
}

export class ReviewStatsDto {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  averagePerformance?: number;
  averageProfessionalism?: number;
  averageReliability?: number;
  averageVenueQuality?: number;
  averagePayment?: number;
  topTags: { tag: string; count: number }[];
}
