import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  IsUrl,
  Min,
  Max,
  ValidateNested,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class SocialLinksDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  instagram?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  facebook?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  twitter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  yelp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  googleMaps?: string;
}

class LocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  streetAddress?: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty()
  @IsString()
  country: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  coordinates?: number[];
}

class EquipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasSoundSystem?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasLighting?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasStage?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasDressingRoom?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasParking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasBackline?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalEquipment?: string[];
}

class OperatingHoursDay {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  open?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  close?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}

class OperatingHoursDto {
  @ApiPropertyOptional({ type: OperatingHoursDay })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDay)
  monday?: OperatingHoursDay;

  @ApiPropertyOptional({ type: OperatingHoursDay })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDay)
  tuesday?: OperatingHoursDay;

  @ApiPropertyOptional({ type: OperatingHoursDay })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDay)
  wednesday?: OperatingHoursDay;

  @ApiPropertyOptional({ type: OperatingHoursDay })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDay)
  thursday?: OperatingHoursDay;

  @ApiPropertyOptional({ type: OperatingHoursDay })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDay)
  friday?: OperatingHoursDay;

  @ApiPropertyOptional({ type: OperatingHoursDay })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDay)
  saturday?: OperatingHoursDay;

  @ApiPropertyOptional({ type: OperatingHoursDay })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDay)
  sunday?: OperatingHoursDay;
}

class VideoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty()
  @IsUrl()
  url: string;
}

export class CreateVenueDto {
  @ApiProperty({ example: 'The Blue Note' })
  @IsString()
  venueName: string;

  @ApiProperty({
    enum: [
      'bar',
      'club',
      'restaurant',
      'concert_hall',
      'hotel',
      'private_events',
      'festival',
      'other',
    ],
  })
  @IsEnum([
    'bar',
    'club',
    'restaurant',
    'concert_hall',
    'hotel',
    'private_events',
    'festival',
    'other',
  ])
  venueType: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['jazz', 'blues'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredGenres?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  coverPhoto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logo?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  photoGallery?: string[];

  @ApiPropertyOptional({ type: [VideoDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VideoDto)
  videos?: VideoDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showPhoneOnProfile?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiProperty({ type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ApiPropertyOptional({ type: SocialLinksDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ type: EquipmentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EquipmentDto)
  equipment?: EquipmentDto;

  @ApiPropertyOptional({ type: OperatingHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  operatingHours?: OperatingHoursDto;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateVenueDto extends PartialType(CreateVenueDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isProfileVisible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAcceptingBookings?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasCompletedSetup?: boolean;
}

export class SearchVenuesDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  venueTypes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredGenres?: string[];

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
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  minCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  radius?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ['rating', 'budget', 'capacity', 'newest'] })
  @IsOptional()
  @IsEnum(['rating', 'budget', 'capacity', 'newest'])
  sortBy?: 'rating' | 'budget' | 'capacity' | 'newest';
}
