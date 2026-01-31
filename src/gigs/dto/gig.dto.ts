import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMaxSize,
  ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GigLocationDto {
  @ApiPropertyOptional({ description: 'Venue address line (free text)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  venueAddress?: string;

  @ApiProperty({ description: 'City name' })
  @IsString()
  @MaxLength(80)
  city!: string;

  @ApiPropertyOptional({ description: 'State/region' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ description: 'Postal/ZIP code' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiProperty({ description: 'Country name' })
  @IsString()
  @MaxLength(80)
  country!: string;

  @ApiProperty({
    description:
      'Exact GeoJSON Point coordinates as [longitude, latitude]. Used for radius-based discovery.',
    example: [72.8777, 19.076],
    type: [Number],
  })
  @IsArray()
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  geoCoordinates!: number[];
}

export class GigPerksDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  providesFood?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  providesDrinks?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  providesAccommodation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  providesTransport?: boolean;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  additionalPerks?: string[];
}

export class CreateGigDto {
  @ApiProperty({
    description: 'Venue profile id that owns this gig',
  })
  @IsMongoId()
  venueId!: string;

  @ApiProperty({ description: 'Gig title' })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ description: 'Gig description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ description: 'Gig date (ISO 8601)' })
  @IsDateString()
  date!: string;

  @ApiProperty({ description: 'Start time (e.g. "19:30")' })
  @IsString()
  @MaxLength(10)
  startTime!: string;

  @ApiPropertyOptional({ description: 'End time (e.g. "22:00")' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  endTime?: string;

  @ApiPropertyOptional({ description: 'Duration in minutes', default: 60 })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(24 * 60)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: 'Number of sets', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  numberOfSets?: number;

  @ApiPropertyOptional({
    description: 'Required genres for this gig',
    type: [String],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @ArrayUnique()
  @IsString({ each: true })
  requiredGenres?: string[];

  @ApiPropertyOptional({ description: 'Specific requirements / notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  specificRequirements?: string;

  @ApiPropertyOptional({ description: 'Artists needed', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  artistsNeeded?: number;

  @ApiProperty({ description: 'Budget amount (number)' })
  @IsNumber()
  @Min(0)
  budget!: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({
    enum: ['fixed', 'negotiable', 'per_hour'],
    default: 'fixed',
  })
  @IsOptional()
  @IsEnum(['fixed', 'negotiable', 'per_hour'])
  paymentType?: 'fixed' | 'negotiable' | 'per_hour';

  @ApiProperty({
    description:
      'Gig location (exact coordinates required for geo discovery).',
    type: GigLocationDto,
  })
  @ValidateNested()
  @Type(() => GigLocationDto)
  location!: GigLocationDto;

  @ApiPropertyOptional({
    description: 'Whether gig is public/visible in artist discovery',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Whether gig is currently accepting applications',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  acceptingApplications?: boolean;

  @ApiPropertyOptional({
    description: 'Perks offered by venue for this gig',
    type: GigPerksDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GigPerksDto)
  perks?: GigPerksDto;

  @ApiPropertyOptional({
    enum: ['draft', 'open'],
    default: 'draft',
    description:
      'Initial status. Use "draft" while composing; set to "open" to publish.',
  })
  @IsOptional()
  @IsEnum(['draft', 'open'])
  status?: 'draft' | 'open';
}

export class UpdateGigDto {
  @ApiPropertyOptional({ description: 'Gig title' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ description: 'Gig description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Gig date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Start time (e.g. "19:30")' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  startTime?: string;

  @ApiPropertyOptional({ description: 'End time (e.g. "22:00")' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  endTime?: string;

  @ApiPropertyOptional({ description: 'Duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(24 * 60)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: 'Number of sets' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  numberOfSets?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @ArrayUnique()
  @IsString({ each: true })
  requiredGenres?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  specificRequirements?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  artistsNeeded?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({ enum: ['fixed', 'negotiable', 'per_hour'] })
  @IsOptional()
  @IsEnum(['fixed', 'negotiable', 'per_hour'])
  paymentType?: 'fixed' | 'negotiable' | 'per_hour';

  @ApiPropertyOptional({ type: GigLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GigLocationDto)
  location?: GigLocationDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acceptingApplications?: boolean;

  @ApiPropertyOptional({ type: GigPerksDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GigPerksDto)
  perks?: GigPerksDto;

  @ApiPropertyOptional({
    enum: ['draft', 'open', 'filled', 'completed', 'cancelled'],
  })
  @IsOptional()
  @IsEnum(['draft', 'open', 'filled', 'completed', 'cancelled'])
  status?: string;
}

export class ApplyToGigDto {
  @ApiPropertyOptional({ description: 'Cover message from artist' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional({ description: 'Proposed rate by artist' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  proposedRate?: number;
}

export class DeclineGigDto {
  @ApiPropertyOptional({ description: 'Reason for declining' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DiscoverGigsDto {
  @ApiPropertyOptional({
    description:
      'Override artist profile genres. If omitted, backend should default to artist genres.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @ArrayUnique()
  @IsString({ each: true })
  genres?: string[];

  @ApiPropertyOptional({
    description:
      'Latitude for geo discovery. If omitted, backend should default to artist location.',
    example: 19.076,
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    description:
      'Longitude for geo discovery. If omitted, backend should default to artist location.',
    example: 72.8777,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    description:
      'Search radius in km. If omitted, backend should default to artist travel radius.',
    example: 25,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusKm?: number;

  @ApiPropertyOptional({
    description: 'Minimum budget filter',
    example: 200,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @ApiPropertyOptional({
    description: 'Maximum budget filter',
    example: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @ApiPropertyOptional({
    description: 'Results page (1-based)',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size',
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    enum: ['relevance', 'date', 'budget', 'distance', 'newest'],
    default: 'relevance',
  })
  @IsOptional()
  @IsEnum(['relevance', 'date', 'budget', 'distance', 'newest'])
  sortBy?: 'relevance' | 'date' | 'budget' | 'distance' | 'newest';
}
