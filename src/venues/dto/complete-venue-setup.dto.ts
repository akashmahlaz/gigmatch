/// 🏢 VENUE SETUP DTO - Complete Venue Profile Setup Validation
///
/// Validates all venue profile data collected during the 5-step onboarding:
/// Step 1: Basic Info (venue name, type, capacity, description, amenities)
/// Step 2: Media (venue photos, virtual tour, Google Maps link)
/// Step 3: Details (location, contact, operating hours, equipment)
/// Step 4: Gig Preferences (genres, budget, typical event types)
/// Step 5: Profile Preview (final submission)
///
/// Features:
/// - Comprehensive field validation
/// - Nested object validation
/// - Array validation with constraints
/// - Coordinate validation for GeoJSON
/// - Custom validators for venue-specific fields

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

export enum VenueType {
  BAR = 'bar',
  RESTAURANT = 'restaurant',
  CLUB = 'club',
  CONCERT_HALL = 'concert_hall',
  HOTEL = 'hotel',
  LOUNGE = 'lounge',
  COFFEE_SHOP = 'coffee_shop',
  BREWERY = 'brewery',
  WINERY = 'winery',
  ART_GALLERY = 'art_gallery',
  COMMUNITY_CENTER = 'community_center',
  FESTIVAL_GROUNDS = 'festival_grounds',
  PRIVATE_EVENT_SPACE = 'private_event_space',
  ROOFTOP = 'rooftop',
  OUTDOOR_VENUE = 'outdoor_venue',
  RECORDING_STUDIO = 'recording_studio',
  REHEARSAL_SPACE = 'rehearsal_space',
  THEATER = 'theater',
  JAZZ_CLUB = 'jazz_club',
  ROCK_VENUE = 'rock_venue',
}

export enum GigType {
  OPEN_MIC = 'open_mic',
  COVER_BAND = 'cover_band',
  ORIGINAL_MUSIC = 'original_music',
  DJ_SET = 'dj_set',
  LIVE_BAND = 'live_band',
  ACOUSTIC = 'acoustic',
  PRIVATE_EVENT = 'private_event',
  CORPORATE_EVENT = 'corporate_event',
  WEDDING = 'wedding',
  FUNDRAISER = 'fundraiser',
  FESTIVAL = 'festival',
  RESIDENCY = 'residency',
}

export enum PaymentType {
  FIXED_FEE = 'fixed_fee',
  DOOR_SPLIT = 'door_split',
  HOURLY_RATE = 'hourly_rate',
  NEGOTIABLE = 'negotiable',
  NO_PAY = 'no_pay',
  TIP_BASED = 'tip_based',
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

export const VALID_VENUE_GENRES = [
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
  'EDM',
  'House',
  'Techno',
  'Ambient',
  'Musical Theatre',
  'Acoustic',
  'Bluegrass',
  'Celtic',
  'Afrobeat',
  'All Genres',
];

// ═══════════════════════════════════════════════════════════════════════════
// LOCATION DTO
// ═══════════════════════════════════════════════════════════════════════════

export class VenueLocationDto {
  @ApiPropertyOptional({ example: 'New York', description: 'City name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    example: 'New York',
    description: 'State or province',
  })
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
    example: '123 Main Street, New York, NY 10001',
    description: 'Full street address',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  streetAddress?: string;

  @ApiPropertyOptional({ example: '10001', description: 'Postal/zip code' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'GeoJSON coordinates [longitude, latitude]',
    example: [-73.9857, 40.7484],
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
    example: 'Manhattan',
    description: 'Neighborhood or district',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  neighborhood?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA DTO
// ═══════════════════════════════════════════════════════════════════════════

export class VenuePhotoDto {
  @ApiProperty({ description: 'URL of the venue photo' })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;

  @ApiPropertyOptional({
    example: 'Main stage view',
    description: 'Photo description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;

  @ApiPropertyOptional({ example: 1, description: 'Display order' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  order?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Is this the main/cover photo',
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class VirtualTourDto {
  @ApiPropertyOptional({
    example: 'https://my.matterport.com/show/?m=xxx',
    description: 'Virtual tour URL',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  tourUrl?: string;

  @ApiPropertyOptional({
    example: 'https://www.youtube.com/watch?v=xxx',
    description: 'Walkthrough video URL',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  videoUrl?: string;

  @ApiPropertyOptional({
    example: 'https://maps.google.com/...?place_id=xxx',
    description: 'Google Maps link',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  googleMapsUrl?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATING HOURS DTO
// ═══════════════════════════════════════════════════════════════════════════

export class OperatingHoursDto {
  @ApiPropertyOptional({
    example: '09:00',
    description: 'Opening time (HH:MM)',
  })
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Opening time must be in HH:MM format',
  })
  openingTime?: string;

  @ApiPropertyOptional({
    example: '22:00',
    description: 'Closing time (HH:MM)',
  })
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Closing time must be in HH:MM format',
  })
  closingTime?: string;

  @ApiPropertyOptional({ example: true, description: 'Is this day closed' })
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @ApiPropertyOptional({
    example: 'Happy hour 4-7pm',
    description: 'Special notes for this day',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}

export class WeeklyHoursDto {
  @ApiPropertyOptional({ description: 'Monday hours' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  monday?: OperatingHoursDto;

  @ApiPropertyOptional({ description: 'Tuesday hours' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  tuesday?: OperatingHoursDto;

  @ApiPropertyOptional({ description: 'Wednesday hours' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  wednesday?: OperatingHoursDto;

  @ApiPropertyOptional({ description: 'Thursday hours' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  thursday?: OperatingHoursDto;

  @ApiPropertyOptional({ description: 'Friday hours' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  friday?: OperatingHoursDto;

  @ApiPropertyOptional({ description: 'Saturday hours' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  saturday?: OperatingHoursDto;

  @ApiPropertyOptional({ description: 'Sunday hours' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  sunday?: OperatingHoursDto;
}

// ═══════════════════════════════════════════════════════════════════════════
// EQUIPMENT & AMENITIES DTO
// ═══════════════════════════════════════════════════════════════════════════

export class EquipmentDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Has professional PA system',
  })
  @IsOptional()
  @IsBoolean()
  hasSoundSystem?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Has stage monitors' })
  @IsOptional()
  @IsBoolean()
  hasMonitors?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Has lighting system' })
  @IsOptional()
  @IsBoolean()
  hasLighting?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Has stage' })
  @IsOptional()
  @IsBoolean()
  hasStage?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Has dressing room' })
  @IsOptional()
  @IsBoolean()
  hasDressingRoom?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Has green room' })
  @IsOptional()
  @IsBoolean()
  hasGreenRoom?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Has backline equipment' })
  @IsOptional()
  @IsBoolean()
  hasBackline?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Has piano' })
  @IsOptional()
  @IsBoolean()
  hasPiano?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Has drums' })
  @IsOptional()
  @IsBoolean()
  hasDrums?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Has loading dock' })
  @IsOptional()
  @IsBoolean()
  hasLoadingDock?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Has parking for band' })
  @IsOptional()
  @IsBoolean()
  hasParking?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Has valet parking' })
  @IsOptional()
  @IsBoolean()
  hasValet?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Wheelchair accessible' })
  @IsOptional()
  @IsBoolean()
  isWheelchairAccessible?: boolean;

  @ApiPropertyOptional({
    example: 'Full backline including drum kit, amps for 3 guitars',
    description: 'Available backline list',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  backlineList?: string;

  @ApiPropertyOptional({
    example: '3-phase power access available',
    description: 'Power requirements info',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  powerInfo?: string;

  @ApiPropertyOptional({
    example: 'Stage plot PDF URL',
    description: 'Stage plot document',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  stagePlotUrl?: string;

  @ApiPropertyOptional({
    example: '20x15 feet',
    description: 'Stage dimensions',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  stageDimensions?: string;

  @ApiPropertyOptional({ example: 8, description: 'Stage height in feet' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  stageHeightFeet?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// GIG PREFERENCES DTO
// ═══════════════════════════════════════════════════════════════════════════

export class GigPreferencesDto {
  @ApiProperty({
    example: ['Jazz', 'Blues', 'Soul'],
    description: 'Preferred music genres (1-5)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsIn(VALID_VENUE_GENRES, { each: true })
  preferredGenres: string[];

  @ApiPropertyOptional({
    example: ['Open Mic', 'Cover Band', 'Original Music'],
    description: 'Types of gigs you host',
  })
  @IsOptional()
  @IsArray()
  @IsIn(Object.values(GigType), { each: true })
  gigTypes?: GigType[];

  @ApiPropertyOptional({
    enum: PaymentType,
    example: PaymentType.DOOR_SPLIT,
    description: 'Typical payment structure',
  })
  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @ApiPropertyOptional({ example: 500, description: 'Minimum budget per gig' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Maximum budget per gig' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @ApiPropertyOptional({
    enum: Currency,
    example: Currency.USD,
    description: 'Currency for budgets',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({
    example: 3,
    description: 'Average gig duration in hours',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  avgGigDuration?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Can provide meals/drinks for performers',
  })
  @IsOptional()
  @IsBoolean()
  providesMusicianMeals?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Provides green room drinks/snacks',
  })
  @IsOptional()
  @IsBoolean()
  providesGreenRoomRefreshments?: boolean;

  @ApiPropertyOptional({
    example: 'Looking for high-energy jazz bands',
    description: 'Additional notes for artists',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notesForArtists?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Looking for new artists',
  })
  @IsOptional()
  @IsBoolean()
  openToNewArtists?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Accepting demo submissions',
  })
  @IsOptional()
  @IsBoolean()
  acceptsDemos?: boolean;

  @ApiPropertyOptional({
    example: 'demo@venue.com',
    description: 'Demo submission email',
  })
  @IsOptional()
  @IsEmail()
  demoSubmissionEmail?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTACT & SOCIAL DTO
// ═══════════════════════════════════════════════════════════════════════════

export class SocialLinksDto {
  @ApiPropertyOptional({
    example: '@venueinstagram',
    description: 'Instagram handle',
  })
  @IsOptional()
  @IsString()
  instagram?: string;

  @ApiPropertyOptional({
    example: 'https://facebook.com/venue',
    description: 'Facebook page',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  facebook?: string;

  @ApiPropertyOptional({
    example: 'https://twitter.com/venue',
    description: 'Twitter handle',
  })
  @IsOptional()
  @IsString()
  twitter?: string;

  @ApiPropertyOptional({
    example: 'https://www.venue.com',
    description: 'Website URL',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({
    example: 'https://www.yelp.com/...',
    description: 'Yelp page',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  yelp?: string;

  @ApiPropertyOptional({
    example: 'https://www.google.com/maps/...',
    description: 'Google Maps listing',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  googleMaps?: string;

  @ApiPropertyOptional({
    example: 'https://venue.tiktok.com',
    description: 'TikTok',
  })
  @IsOptional()
  @IsString()
  tiktok?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE VENUE SETUP DTO (Main DTO)
// ═══════════════════════════════════════════════════════════════════════════

export class CompleteVenueSetupDto {
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: BASIC INFO
  // ═══════════════════════════════════════════════════════════════════════

  @ApiProperty({
    example: 'The Blue Note Jazz Club',
    description: 'Official venue name',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  venueName: string;

  @ApiProperty({
    enum: VenueType,
    example: VenueType.JAZZ_CLUB,
    description: 'Type of venue',
  })
  @IsEnum(VenueType)
  venueType: VenueType;

  @ApiPropertyOptional({
    example: 150,
    description: 'Maximum venue capacity',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50000)
  capacity?: number;

  @ApiPropertyOptional({
    example: 'A premier jazz club in the heart of downtown...',
    description: 'Venue description (max 2000 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    example: ['Professional Stage', 'Sound System', 'Lighting'],
    description: 'Amenities offered (max 15)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(100, { each: true })
  amenities?: string[];

  @ApiPropertyOptional({
    example: 'John Smith',
    description: 'Contact person name',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  contactPerson?: string;

  @ApiPropertyOptional({
    example: 'Owner',
    description: 'Contact person role',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactRole?: string;

  @ApiPropertyOptional({
    example: 1958,
    description: 'Year venue was established',
  })
  @IsOptional()
  @IsNumber()
  @Min(1800)
  @Max(2030)
  yearEstablished?: number;

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: MEDIA
  // ═══════════════════════════════════════════════════════════════════════

  @ApiPropertyOptional({
    description: 'Main venue photo URL',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  profilePhotoUrl?: string;

  @ApiPropertyOptional({
    type: [VenuePhotoDto],
    description: 'Venue photo gallery (max 10 photos)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => VenuePhotoDto)
  photoGallery?: VenuePhotoDto[];

  @ApiPropertyOptional({
    description: 'Virtual tour and maps links',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => VirtualTourDto)
  virtualTour?: VirtualTourDto;

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: DETAILS & LOCATION
  // ═══════════════════════════════════════════════════════════════════════

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Contact phone number',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Please provide a valid phone number',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Show phone on public profile',
  })
  @IsOptional()
  @IsBoolean()
  showPhoneOnProfile?: boolean;

  @ApiPropertyOptional({
    example: 'bookings@venue.com',
    description: 'Booking email',
  })
  @IsOptional()
  @IsEmail()
  bookingEmail?: string;

  @ApiPropertyOptional({
    example: 'events@venue.com',
    description: 'Events email (if different)',
  })
  @IsOptional()
  @IsEmail()
  eventsEmail?: string;

  @ApiProperty({
    description: 'Location data with coordinates',
  })
  @ValidateNested()
  @Type(() => VenueLocationDto)
  location: VenueLocationDto;

  @ApiPropertyOptional({
    description: 'Weekly operating hours',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WeeklyHoursDto)
  operatingHours?: WeeklyHoursDto;

  @ApiPropertyOptional({
    description: 'Equipment and amenities available',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EquipmentDto)
  equipment?: EquipmentDto;

  @ApiPropertyOptional({
    description: 'Social media links',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;

  @ApiPropertyOptional({
    example: 'Main entrance on Main St, valet parking available',
    description: 'Directions for performers',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  directions?: string;

  @ApiPropertyOptional({
    example: 'Load in from rear alley, call 30 min before',
    description: 'Load-in instructions for artists',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  loadInInstructions?: string;

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: GIG PREFERENCES
  // ═══════════════════════════════════════════════════════════════════════

  @ApiProperty({
    description: 'Gig preferences and requirements',
  })
  @ValidateNested()
  @Type(() => GigPreferencesDto)
  gigPreferences: GigPreferencesDto;

  // ═══════════════════════════════════════════════════════════════════════
  // PREFERENCES & DISCOVERY
  // ═══════════════════════════════════════════════════════════════════════

  @ApiPropertyOptional({
    example: true,
    description: 'Venue is active and accepting bookings',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Show venue in discovery searches',
  })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional({
    example: 'Family-friendly until 9pm, 21+ after',
    description: 'House rules for performers',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  houseRules?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Has promoted acts before',
  })
  @IsOptional()
  @IsBoolean()
  hasPromotedActs?: boolean;

  @ApiPropertyOptional({
    example: ['Snarky Puppy', 'Gregory Porter'],
    description: 'Notable artists who performed',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notablePastActs?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE VENUE PROFILE DTO (Partial Updates)
// ═══════════════════════════════════════════════════════════════════════════

export class UpdateVenueProfileDto extends PartialType(CompleteVenueSetupDto) {
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
// VENUE QUERY DTO (For Discovery/Search)
// ═══════════════════════════════════════════════════════════════════════════

export class VenueSearchQueryDto {
  @ApiPropertyOptional({
    example: 'Jazz Club',
    description: 'Filter by venue type',
    enum: VenueType,
  })
  @IsOptional()
  @IsEnum(VenueType)
  venueType?: VenueType;

  @ApiPropertyOptional({
    example: ['Jazz', 'Blues'],
    description: 'Filter by preferred genres',
  })
  @IsOptional()
  @IsArray()
  @IsIn(VALID_VENUE_GENRES, { each: true })
  genres?: string[];

  @ApiPropertyOptional({
    example: 40.7128,
    description: 'Latitude for location-based search',
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    example: -74.006,
    description: 'Longitude for location-based search',
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    example: 25,
    description: 'Search radius in miles',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusMiles?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Minimum capacity required',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minCapacity?: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'Maximum budget per gig',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Has sound system',
  })
  @IsOptional()
  @IsBoolean()
  hasSoundSystem?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Has stage',
  })
  @IsOptional()
  @IsBoolean()
  hasStage?: boolean;

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
  @IsIn(['createdAt', 'venueName', 'profileCompleteness', 'capacity'])
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
// COMPLETE VENUE RESPONSE DTO (API Responses)
// ═══════════════════════════════════════════════════════════════════════════

export class CompleteVenueResponseDto {
  id: string;
  userId: string;
  venueName: string;
  venueType: VenueType;
  capacity?: number;
  description?: string;
  amenities?: string[];
  contactPerson?: string;
  contactRole?: string;
  yearEstablished?: number;
  profilePhotoUrl?: string;
  photoGallery?: VenuePhotoDto[];
  virtualTour?: VirtualTourDto;
  phone?: string;
  showPhoneOnProfile: boolean;
  bookingEmail?: string;
  eventsEmail?: string;
  location: VenueLocationDto;
  operatingHours?: WeeklyHoursDto;
  equipment?: EquipmentDto;
  socialLinks?: SocialLinksDto;
  directions?: string;
  loadInInstructions?: string;
  gigPreferences: GigPreferencesDto;
  isActive: boolean;
  isVisible: boolean;
  houseRules?: string;
  hasPromotedActs: boolean;
  notablePastActs?: string[];
  profileCompleteness: number;
  hasCompletedSetup: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// VENUE TYPES & AMENITIES CONSTANTS (for reference)
// ═══════════════════════════════════════════════════════════════════════════

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  [VenueType.BAR]: 'Bar',
  [VenueType.RESTAURANT]: 'Restaurant',
  [VenueType.CLUB]: 'Club',
  [VenueType.CONCERT_HALL]: 'Concert Hall',
  [VenueType.HOTEL]: 'Hotel',
  [VenueType.LOUNGE]: 'Lounge',
  [VenueType.COFFEE_SHOP]: 'Coffee Shop',
  [VenueType.BREWERY]: 'Brewery',
  [VenueType.WINERY]: 'Winery',
  [VenueType.ART_GALLERY]: 'Art Gallery',
  [VenueType.COMMUNITY_CENTER]: 'Community Center',
  [VenueType.FESTIVAL_GROUNDS]: 'Festival Grounds',
  [VenueType.PRIVATE_EVENT_SPACE]: 'Private Event Space',
  [VenueType.ROOFTOP]: 'Rooftop',
  [VenueType.OUTDOOR_VENUE]: 'Outdoor Venue',
  [VenueType.RECORDING_STUDIO]: 'Recording Studio',
  [VenueType.REHEARSAL_SPACE]: 'Rehearsal Space',
  [VenueType.THEATER]: 'Theater',
  [VenueType.JAZZ_CLUB]: 'Jazz Club',
  [VenueType.ROCK_VENUE]: 'Rock Venue',
};

export const COMMON_AMENITIES = [
  'Professional Stage',
  'Sound System',
  'Stage Monitors',
  'Lighting System',
  'DJ Equipment',
  'Projector',
  'Microphones',
  'Backline',
  'Piano',
  'Drums',
  'Green Room',
  'Dressing Room',
  'Loading Dock',
  'Parking',
  'Valet Parking',
  'Wheelchair Accessible',
  'Outdoor Seating',
  'VIP Area',
  'Catering',
  'Full Bar',
  'Kitchen',
  'WiFi',
  'Air Conditioning',
  'Heating',
];
