/// 🎸 ARTIST SETUP DTO - Complete Profile Setup Validation
///
/// Validates all artist profile data collected during the 5-step onboarding:
/// Step 1: Basic Info (display name, stage name, bio, genres, influences)
/// Step 2: Media Upload (photos, audio, videos)
/// Step 3: Contact & Location (phone, socials, location, travel radius)
/// Step 4: Availability & Pricing (calendar, price range)
/// Step 5: Profile Preview (final submission)
///
/// Features:
/// - Comprehensive field validation
/// - Nested object validation
/// - Array validation with constraints
/// - Coordinate validation for GeoJSON
/// - Custom validators for music-specific fields

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  IsObject,
  IsUrl,
  IsPhoneNumber,
  IsDateString,
  ValidateNested,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
  ArrayMinSize,
  ArrayMaxSize,
  IsIn,
  IsDefined,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS & TYPES
// ═══════════════════════════════════════════════════════════════════════════

export enum ArtistType {
  SOLO = 'solo',
  BAND = 'band',
  DUO = 'duo',
  ORCHESTRA = 'orchestra',
  DJ = 'dj',
  PRODUCER = 'producer',
}

export enum ExperienceLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  PROFESSIONAL = 'professional',
  WORLD_CLASS = 'world_class',
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  CAD = 'CAD',
  AUD = 'AUD',
  INR = 'INR',
  JPY = 'JPY',
}

export const VALID_GENRES = [
  'Rock',
  'Pop',
  'Jazz',
  'Hip-Hop',
  'Electronic',
  'R&B',
  'Country',
  'Classical',
  'Folk',
  'Metal',
  'Indie',
  'Blues',
  'Reggae',
  'Latin',
  'Soul',
  'Funk',
  'Alternative',
  'Punk',
  'Gospel',
  'World',
  'K-Pop',
  'Cumbia',
  'Bachata',
  'Salsa',
  'Tango',
  'Flamenco',
  'Grunge',
  'EDM',
  'House',
  'Techno',
  'Trance',
  'Dubstep',
  'Drum & Bass',
  'Ambient',
  'Soundtrack',
  'Musical Theatre',
  'Opera',
  'Acoustic',
  'Bluegrass',
  'Zydeco',
  'Celtic',
  'Afrobeat',
  'Highlife',
  'Soukous',
  'Zouk',
  'Merengue',
  'Samba',
  'Bossa Nova',
  'Forró',
  'Sertanejo',
  'Cumbia',
  'Reggaeton',
  'Tropical',
];

// ═══════════════════════════════════════════════════════════════════════════
// LOCATION DTO
// ═══════════════════════════════════════════════════════════════════════════

export class ArtistLocationDto {
  @ApiPropertyOptional({ example: 'Nashville', description: 'City name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Tennessee', description: 'State or province' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: 'USA', description: 'Country name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({
    description: 'GeoJSON coordinates [longitude, latitude]',
    example: [-86.7816, 36.1627],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  @Min(-180, { each: true })
  @Max(180, { each: true })
  coordinates?: [number, number];

  @ApiPropertyOptional({
    example: 50,
    description: 'Maximum travel distance in miles',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  travelRadius?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL LINKS DTO
// ═══════════════════════════════════════════════════════════════════════════

export class SocialLinksDto {
  @ApiPropertyOptional({
    example: '@johnsmithmusic',
    description: 'Instagram username (without @)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'Instagram username can only contain letters, numbers, dots, and underscores',
  })
  instagram?: string;

  @ApiPropertyOptional({
    example: 'johnsmith',
    description: 'Spotify username or artist ID',
  })
  @IsOptional()
  @IsString()
  spotify?: string;

  @ApiPropertyOptional({
    example: 'UCxyz...',
    description: 'YouTube channel ID',
  })
  @IsOptional()
  @IsString()
  youtube?: string;

  @ApiPropertyOptional({
    example: 'johnsmith',
    description: 'SoundCloud username',
  })
  @IsOptional()
  @IsString()
  soundcloud?: string;

  @ApiPropertyOptional({
    example: 'johnsmith',
    description: 'TikTok username (without @)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'TikTok username can only contain letters, numbers, dots, and underscores',
  })
  tiktok?: string;

  @ApiPropertyOptional({
    example: 'https://johnsmith.com',
    description: 'Personal website URL',
  })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({
    example: 'https://open.spotify.com/artist/...',
    description: 'Spotify artist link',
  })
  @IsOptional()
  @IsUrl()
  spotifyLink?: string;

  @ApiPropertyOptional({
    example: 'https://music.apple.com/artist/...',
    description: 'Apple Music artist link',
  })
  @IsOptional()
  @IsUrl()
  appleMusicLink?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA DTO
// ═══════════════════════════════════════════════════════════════════════════

export class MediaFileDto {
  @ApiProperty({ description: 'URL of the uploaded file' })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ description: 'Original filename' })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({ description: 'MIME type of the file' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  size?: number;

  @ApiPropertyOptional({ description: 'Duration in seconds for audio/video' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;

  @ApiPropertyOptional({ description: 'Thumbnail URL for video' })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}

export class AudioSampleDto extends MediaFileDto {
  @ApiPropertyOptional({ example: 'Original Mix', description: 'Track title' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ example: 128, description: 'Bitrate in kbps' })
  @IsOptional()
  @IsNumber()
  @Min(64)
  @Max(320)
  bitrate?: number;
}

export class VideoSampleDto extends MediaFileDto {
  @ApiPropertyOptional({ example: 'Live at Madison Square Garden', description: 'Video title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export class PhotoGalleryDto extends MediaFileDto {
  @ApiPropertyOptional({ example: 'Band photo from tour', description: 'Photo description' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// AVAILABILITY DTO
// ═══════════════════════════════════════════════════════════════════════════

export class AvailabilitySlotDto {
  @ApiProperty({ example: '2024-03-15', description: 'Date of availability' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '19:00', description: 'Start time (HH:MM format)' })
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Start time must be in HH:MM format (24-hour)',
  })
  startTime: string;

  @ApiProperty({ example: '23:00', description: 'End time (HH:MM format)' })
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'End time must be in HH:MM format (24-hour)',
  })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Specific notes for this slot',
    example: 'Available for acoustic sets only',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: false, description: 'Whether this slot is recurring weekly' })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    example: ['Monday', 'Wednesday', 'Friday'],
    description: 'Days of week if this is a recurring pattern',
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], {
    each: true,
  })
  recurringDays?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// PRICING DTO
// ═══════════════════════════════════════════════════════════════════════════

export class PricingDto {
  @ApiProperty({ example: 500, description: 'Minimum gig fee' })
  @IsNumber()
  @Min(0)
  minPrice: number;

  @ApiProperty({ example: 2000, description: 'Maximum gig fee' })
  @IsNumber()
  @Min(0)
  maxPrice: number;

  @ApiPropertyOptional({
    enum: Currency,
    example: Currency.USD,
    description: 'Currency code',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({
    example: 60,
    description: 'Default set duration in minutes',
  })
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(480)
  setDuration?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Willing to negotiate on price',
  })
  @IsOptional()
  @IsBoolean()
  priceNegotiable?: boolean;

  @ApiPropertyOptional({
    example: 'For bookings over 3 hours, custom pricing available',
    description: 'Additional pricing notes',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pricingNotes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// EQUIPMENT & SETUP DTO
// ═══════════════════════════════════════════════════════════════════════════

export class EquipmentDto {
  @ApiPropertyOptional({ example: true, description: 'Has own PA system' })
  @IsOptional()
  @IsBoolean()
  hasPA?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Has own instruments' })
  @IsOptional()
  @IsBoolean()
  hasInstruments?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Needs venue backline' })
  @IsOptional()
  @IsBoolean()
  needsBackline?: boolean;

  @ApiPropertyOptional({
    example: 'Full drum kit, amplifiers for 3 guitars, vocals',
    description: 'Equipment list',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  equipmentList?: string;

  @ApiPropertyOptional({
    example: 'Need 3-phase power access',
    description: 'Power requirements',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  powerRequirements?: string;

  @ApiPropertyOptional({
    example: '4-piece setup, 30 min load-in time',
    description: 'Stage plot or setup requirements',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  stagePlot?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE ARTIST SETUP DTO (Main DTO)
// ═══════════════════════════════════════════════════════════════════════════

export class CompleteArtistSetupDto {
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: BASIC INFO
  // ═══════════════════════════════════════════════════════════════════════

  @ApiProperty({
    example: 'John Smith Band',
    description: 'Display name for the artist/band',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  displayName: string;

  @ApiPropertyOptional({
    example: 'The JSB',
    description: 'Stage name or abbreviation (optional)',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  stageName?: string;

  @ApiPropertyOptional({
    example: 'John Smith Band is a high-energy rock act from Nashville...',
    description: 'Artist biography (max 2000 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiProperty({
    example: ['Rock', 'Blues', 'Soul'],
    description: 'Music genres (1-5)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsIn(VALID_GENRES, { each: true })
  genres: string[];

  @ApiPropertyOptional({
    example: ['Jimi Hendrix', 'Eric Clapton', 'Stevie Ray Vaughan'],
    description: 'Musical influences (max 10)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  influences?: string[];

  @ApiPropertyOptional({
    enum: ArtistType,
    example: ArtistType.BAND,
    description: 'Type of musical act',
  })
  @IsOptional()
  @IsEnum(ArtistType)
  artistType?: ArtistType;

  @ApiPropertyOptional({
    enum: ExperienceLevel,
    example: ExperienceLevel.PROFESSIONAL,
    description: 'Years of experience',
  })
  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @ApiPropertyOptional({
    example: 10,
    description: 'Years of professional experience',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  yearsActive?: number;

  @ApiPropertyOptional({
    example: 4,
    description: 'Number of band members (for bands)',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  bandMembers?: number;

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: MEDIA
  // ═══════════════════════════════════════════════════════════════════════

  @ApiPropertyOptional({
    description: 'Profile photo URL',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  profilePhotoUrl?: string;

  @ApiPropertyOptional({
    type: [PhotoGalleryDto],
    description: 'Photo gallery (max 6 photos)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => PhotoGalleryDto)
  photoGallery?: PhotoGalleryDto[];

  @ApiPropertyOptional({
    type: [AudioSampleDto],
    description: 'Audio samples (max 3)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => AudioSampleDto)
  audioSamples?: AudioSampleDto[];

  @ApiPropertyOptional({
    type: [VideoSampleDto],
    description: 'Video samples (max 2)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => VideoSampleDto)
  videoSamples?: VideoSampleDto[];

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: CONTACT & LOCATION
  // ═══════════════════════════════════════════════════════════════════════

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Phone number for quick venue calls',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Please provide a valid phone number',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Show phone number on public profile',
  })
  @IsOptional()
  @IsBoolean()
  showPhoneOnProfile?: boolean;

  @ApiPropertyOptional({
    description: 'Social media links',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;

  @ApiProperty({
    description: 'Location data with coordinates',
  })
  @ValidateNested()
  @Type(() => ArtistLocationDto)
  location: ArtistLocationDto;

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: AVAILABILITY & PRICING
  // ═══════════════════════════════════════════════════════════════════════

  @ApiPropertyOptional({
    type: [AvailabilitySlotDto],
    description: 'Availability slots for gigs',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  availability?: AvailabilitySlotDto[];

  @ApiPropertyOptional({
    description: 'Pricing information',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PricingDto)
  pricing?: PricingDto;

  @ApiPropertyOptional({
    description: 'Equipment and setup requirements',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EquipmentDto)
  equipment?: EquipmentDto;

  @ApiPropertyOptional({
    example: 'Traveling nationally, base in Nashville',
    description: 'Touring notes or special circumstances',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  touringNotes?: string;

  // ═══════════════════════════════════════════════════════════════════════
  // PREFERENCES & DISCOVERY
  // ═══════════════════════════════════════════════════════════════════════

  @ApiPropertyOptional({
    example: ['bars', 'restaurants', 'hotels', 'private_events'],
    description: 'Preferred venue types',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredVenueTypes?: string[];

  @ApiPropertyOptional({
    example: true,
    description: 'Open to gig opportunities',
  })
  @IsOptional()
  @IsBoolean()
  openToGigs?: boolean;

  @ApiPropertyOptional({
    example: 'Must have PA system',
    description: 'Gig requirements or deal breakers',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  gigRequirements?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Has transportation for equipment',
  })
  @IsOptional()
  @IsBoolean()
  hasTransportation?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE ARTIST PROFILE DTO (Partial Updates)
// ═══════════════════════════════════════════════════════════════════════════

export class UpdateArtistProfileDto extends PartialType(CompleteArtistSetupDto) {
  @ApiPropertyOptional({
    example: 75,
    description: 'Profile completeness percentage',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  profileCompleteness?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ARTIST QUERY DTO (For Discovery/Search)
// ═══════════════════════════════════════════════════════════════════════════

export class ArtistSearchQueryDto {
  @ApiPropertyOptional({
    example: 'Rock',
    description: 'Filter by primary genre',
  })
  @IsOptional()
  @IsIn(VALID_GENRES)
  genre?: string;

  @ApiPropertyOptional({
    example: ['Rock', 'Blues'],
    description: 'Filter by multiple genres (OR logic)',
  })
  @IsOptional()
  @IsArray()
  @IsIn(VALID_GENRES, { each: true })
  genres?: string[];

  @ApiPropertyOptional({
    example: 36.1627,
    description: 'Latitude for location-based search',
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    example: -86.7816,
    description: 'Longitude for location-based search',
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Search radius in miles',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusMiles?: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'Maximum hourly rate',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Minimum hourly rate',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    enum: ArtistType,
    example: ArtistType.BAND,
    description: 'Filter by artist type',
  })
  @IsOptional()
  @IsEnum(ArtistType)
  artistType?: ArtistType;

  @ApiPropertyOptional({
    enum: ExperienceLevel,
    example: ExperienceLevel.PROFESSIONAL,
    description: 'Filter by experience level',
  })
  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (1-indexed)',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Results per page',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'createdAt',
    description: 'Sort field',
  })
  @IsOptional()
  @IsIn(['createdAt', 'displayName', 'reputationScore', 'profileCompleteness'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    example: 'desc',
    description: 'Sort order',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE ARTIST RESPONSE DTO (API Responses)
// ═══════════════════════════════════════════════════════════════════════════

export class CompleteArtistResponseDto {
  id: string;
  userId: string;
  displayName: string;
  stageName?: string;
  bio?: string;
  genres: string[];
  influences?: string[];
  artistType?: ArtistType;
  experienceLevel?: ExperienceLevel;
  yearsActive?: number;
  bandMembers?: number;
  profilePhotoUrl?: string;
  photoGallery?: PhotoGalleryDto[];
  audioSamples?: AudioSampleDto[];
  videoSamples?: VideoSampleDto[];
  phone?: string;
  showPhoneOnProfile: boolean;
  socialLinks?: SocialLinksDto;
  location: ArtistLocationDto;
  availability?: AvailabilitySlotDto[];
  pricing?: PricingDto;
  equipment?: EquipmentDto;
  preferredVenueTypes?: string[];
  openToGigs: boolean;
  gigRequirements?: string;
  hasTransportation?: boolean;
  touringNotes?: string;
  reputationScore?: number;
  totalReviews?: number;
  profileCompleteness: number;
  isProfileVisible: boolean;
  hasCompletedSetup: boolean;
  createdAt: Date;
  updatedAt: Date;
}
