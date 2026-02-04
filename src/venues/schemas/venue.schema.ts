/// 🏢 GIGMATCH VENUE SCHEMA
///
/// Comprehensive venue profile model for the gig matching platform
/// Includes all fields needed for hosting gigs, discovering artists, and managing bookings

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

export enum VenueType {
  BAR = 'bar',
  CLUB = 'club',
  RESTAURANT = 'restaurant',
  HOTEL = 'hotel',
  CAFE = 'cafe',
  THEATER = 'theater',
  CONCERT_HALL = 'concert_hall',
  WEDDING_VENUE = 'wedding_venue',
  CORPORATE_EVENT_SPACE = 'corporate_event_space',
  OUTDOOR_VENUE = 'outdoor_venue',
  JAZZ_CLUB = 'jazz_club',
  BREWERY = 'brewery',
  WINERY = 'winery',
  COMMUNITY_CENTER = 'community_center',
  RELIGIOUS_VENUE = 'religious_venue',
  PRIVATE_HOME = 'private_home',
  FESTIVAL_GROUNDS = 'festival_grounds',
  RECORDING_STUDIO = 'recording_studio',
  NIGHTCLUB = 'nightclub',
  LOUNGE = 'lounge',
  OTHER = 'other',
}

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  DISPUTED = 'disputed',
}

export enum GigStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  FILLED = 'filled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// ═══════════════════════════════════════════════════════════════════════════
// EMBEDDED SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/// Social media links for venue
@Schema({ _id: false })
export class VenueSocialLinks {
  @Prop()
  instagram?: string;

  @Prop()
  facebook?: string;

  @Prop()
  twitter?: string;

  @Prop()
  website?: string;

  @Prop()
  yelp?: string;

  @Prop()
  googleMaps?: string;

  @Prop()
  tripadvisor?: string;

  @Prop()
  weddingwire?: string;

  @Prop()
  theknot?: string;
}

export const VenueSocialLinksSchema =
  SchemaFactory.createForClass(VenueSocialLinks);

/// Location with GeoJSON coordinates for artist discovery
@Schema({ _id: false })
export class VenueLocation {
  @Prop({ type: String, default: 'Point' })
  type: string = 'Point';

  @Prop({ type: [Number], default: [0, 0] })
  coordinates: [number, number] = [0, 0]; // [longitude, latitude]

  @Prop()
  streetAddress?: string;

  @Prop()
  city?: string;

  @Prop()
  state?: string;

  @Prop()
  country?: string;

  @Prop()
  postalCode?: string;

  @Prop()
  formattedAddress?: string;
}

export const VenueLocationSchema = SchemaFactory.createForClass(VenueLocation);

/// Operating hours for the venue
@Schema({ _id: false })
export class OperatingHours {
  @Prop({ required: true })
  dayOfWeek!: number; // 0 = Sunday, 6 = Saturday

  @Prop()
  openTime?: string; // HH:MM format

  @Prop()
  closeTime?: string; // HH:MM format

  @Prop({ default: true })
  isOpen: boolean = true;

  @Prop()
  specialNotes?: string;
}

export const OperatingHoursSchema =
  SchemaFactory.createForClass(OperatingHours);

/// Equipment and amenities provided by venue
@Schema({ _id: false })
export class VenueEquipment {
  @Prop({ default: false })
  hasSoundSystem: boolean = false;

  @Prop()
  soundSystemDetails?: string;

  @Prop({ default: false })
  hasLighting: boolean = false;

  @Prop()
  lightingDetails?: string;

  @Prop({ default: false })
  hasStage: boolean = false;

  @Prop({ default: false })
  hasBackline: boolean = false;

  @Prop()
  backlineDetails?: string;

  @Prop({ default: false })
  hasDressingRoom: boolean = false;

  @Prop({ default: false })
  hasGreenRoom: boolean = false;

  @Prop({ default: false })
  hasParking: boolean = false;

  @Prop()
  parkingDetails?: string;

  @Prop({ default: false })
  hasValet: boolean = false;

  @Prop({ default: false })
  hasCatering: boolean = false;

  @Prop({ default: false })
  hasBar: boolean = false;

  @Prop({ default: false })
  hasKitchen: boolean = false;

  @Prop({ default: false })
  hasOutdoorSpace: boolean = false;

  @Prop({ default: false })
  hasAirConditioning: boolean = false;

  @Prop({ default: false })
  hasHeating: boolean = false;

  @Prop({ default: false })
  isWheelchairAccessible: boolean = false;

  @Prop({ default: false })
  hasWifi: boolean = false;

  @Prop()
  wifiDetails?: string;

  @Prop({ default: false })
  hasProjector: boolean = false;

  @Prop({ default: false })
  hasMicrophones: boolean = false;

  @Prop({ type: [String], default: [] })
  additionalEquipment: string[] = [];

  @Prop()
  equipmentNotes?: string;
}

export const VenueEquipmentSchema =
  SchemaFactory.createForClass(VenueEquipment);

/// Gig posted by venue
@Schema({ _id: true })
export class Gig {
  @Prop({ type: Types.ObjectId, ref: 'Gig' })
  originalGigId?: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  date!: Date;

  @Prop()
  startTime?: string;

  @Prop()
  endTime?: string;

  @Prop({ enum: GigStatus, type: String, default: GigStatus.OPEN })
  status: GigStatus = GigStatus.OPEN;

  @Prop({ type: [String], default: [] })
  genres: string[] = [];

  @Prop()
  budgetType?: string; // fixed, hourly, negotiable

  @Prop({ type: Number, default: 0 })
  budgetMin: number = 0;

  @Prop({ type: Number, default: 0 })
  budgetMax: number = 0;

  @Prop({ default: 'USD' })
  currency: string = 'USD';

  @Prop({ type: Number, min: 15, max: 480, default: 60 })
  setDurationMinutes: number = 60;

  @Prop({ type: [String], default: [] })
  equipmentProvided: string[] = [];

  @Prop({ type: [String], default: [] })
  equipmentNeeded: string[] = [];

  @Prop({ type: Number, default: 1 })
  slotsAvailable: number = 1;

  @Prop({ type: [Types.ObjectId], default: [], ref: 'Artist' })
  applicants: Types.ObjectId[] = [];

  @Prop({ type: Types.ObjectId, ref: 'Artist', default: null })
  bookedArtist?: Types.ObjectId;

  @Prop()
  cancellationReason?: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date = new Date();

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const GigSchema = SchemaFactory.createForClass(Gig);

/// Review statistics summary for venue
@Schema({ _id: false })
export class VenueReviewStats {
  @Prop({ default: 0 })
  totalReviews: number = 0;

  @Prop({ default: 0.0 })
  averageRating: number = 0.0;

  @Prop({ type: [Number], default: [0, 0, 0, 0, 0] })
  ratingDistribution: number[] = [0, 0, 0, 0, 0];

  @Prop({ default: 0 })
  fiveStarCount: number = 0;

  @Prop({ default: 0 })
  fourStarCount: number = 0;

  @Prop({ default: 0 })
  threeStarCount: number = 0;

  @Prop({ default: 0 })
  twoStarCount: number = 0;

  @Prop({ default: 0 })
  oneStarCount: number = 0;

  @Prop({ default: 0.0 })
  communicationScore: number = 0.0;

  @Prop({ default: 0.0 })
  punctualityScore: number = 0.0;

  @Prop({ default: 0.0 })
  facilitiesScore: number = 0.0;

  @Prop({ default: 0.0 })
  paymentScore: number = 0.0;
}

export const VenueReviewStatsSchema =
  SchemaFactory.createForClass(VenueReviewStats);

/// Past booking reference
@Schema({ _id: true })
export class PastBooking {
  @Prop({ type: Types.ObjectId, ref: 'Artist', required: true })
  artistId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Gig' })
  gigId?: Types.ObjectId;

  @Prop({ required: true })
  artistName!: string;

  @Prop({ type: Date, required: true })
  gigDate!: Date;

  @Prop({ default: false })
  wasCompleted: boolean = false;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ enum: BookingStatus, type: String })
  status?: BookingStatus;

  @Prop()
  artistFeedback?: string;

  @Prop()
  cancellationReason?: string;
}

export const PastBookingSchema = SchemaFactory.createForClass(PastBooking);

/// Contact person information
@Schema({ _id: false })
export class ContactPerson {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  email!: string;

  @Prop()
  phone?: string;

  @Prop()
  role?: string; // Owner, Manager, Booking Agent, etc.

  @Prop({ default: true })
  isPrimary: boolean = true;
}

export const ContactPersonSchema = SchemaFactory.createForClass(ContactPerson);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN VENUE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

@Schema({ timestamps: true, collection: 'venues' })
export class Venue {
  _id: Types.ObjectId;

  /// Reference to User account
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  /// Venue official name
  @Prop({ required: true, trim: true, maxlength: 200 })
  venueName!: string;

  /// Venue type
  @Prop({
    enum: VenueType,
    type: String,
    default: VenueType.OTHER,
  })
  venueType: VenueType = VenueType.OTHER;

  /// Short tagline for the venue
  @Prop({ trim: true, maxlength: 100 })
  tagline?: string;

  /// Full description of the venue
  @Prop({ maxlength: 2000 })
  description?: string;

  /// Location data with GeoJSON coordinates
  @Prop({ type: VenueLocation })
  location?: VenueLocation;

  /// Operating hours (7 days)
  @Prop({ type: [OperatingHours], default: [] })
  operatingHours: OperatingHours[] = [];

  /// Contact information
  @Prop({ type: [ContactPerson], default: [] })
  contacts: ContactPerson[] = [];

  /// Phone number for general inquiries
  @Prop()
  phone?: string;

  /// Contact email
  @Prop()
  contactEmail?: string;

  /// Social media links
  @Prop({ type: VenueSocialLinks })
  socialLinks?: VenueSocialLinks;

  /// Total capacity
  @Prop({ default: 0, min: 0 })
  capacity: number = 0;

  /// Square footage
  @Prop({ min: 0 })
  squareFootage?: number;

  /// Stage dimensions (if applicable)
  @Prop()
  stageWidth?: number;

  @Prop()
  stageDepth?: number;

  @Prop()
  stageHeight?: number;

  /// Ceiling height
  @Prop({ min: 0 })
  ceilingHeight?: number;

  /// Equipment and amenities
  @Prop({ type: VenueEquipment, default: () => new VenueEquipment() })
  equipment: VenueEquipment = new VenueEquipment();

  /// Photos of the venue
  @Prop({
    type: [
      {
        url: String,
        caption: String,
        isPrimary: Boolean,
        order: Number,
        uploadedAt: Date,
      },
    ],
    default: [],
  })
  photos: Array<{
    url: string;
    caption?: string;
    isPrimary: boolean;
    order: number;
    uploadedAt: Date;
  }> = [];

  /// Virtual tour URL
  @Prop()
  virtualTourUrl?: string;

  /// Preferred genres for bookings
  @Prop({ type: [String], default: [] })
  preferredGenres: string[] = [];

  /// Typical gig types hosted
  @Prop({ type: [String], default: [] })
  gigTypes: string[] = [];

  /// Average budget range
  @Prop({ type: Number, default: 0 })
  budgetMin: number = 0;

  @Prop({ type: Number, default: 0 })
  budgetMax: number = 0;

  @Prop({ default: 'USD' })
  currency: string = 'USD';

  /// Average gig duration
  @Prop({ type: Number, default: 60 })
  typicalGigDuration: number = 60;

  /// Typical gig times
  @Prop({ type: [String], default: [] })
  typicalGigTimes: string[] = [];

  /// Days of week typically hosting gigs
  @Prop({ type: [Number], default: [] })
  typicalGigDays: number[] = [];

  /// Booking lead time required (days)
  @Prop({ default: 7, min: 0 })
  bookingLeadTimeDays: number = 7;

  /// Cancellation policy
  @Prop()
  cancellationPolicy?: string;

  /// Posted gigs
  @Prop({ type: [Gig], default: [] })
  gigs: Gig[] = [];

  /// Past bookings for reference
  @Prop({ type: [PastBooking], default: [] })
  pastBookings: PastBooking[] = [];

  /// Review statistics
  @Prop({ type: VenueReviewStats, default: () => new VenueReviewStats() })
  reviewStats: VenueReviewStats = new VenueReviewStats();

  /// Total gigs hosted
  @Prop({ default: 0 })
  totalGigsHosted: number = 0;

  /// Verified venue status
  @Prop({ default: false })
  isVerified: boolean = false;

  @Prop({ type: Date })
  verifiedAt?: Date;

  /// Venue is actively looking for artists
  @Prop({ default: true })
  isOpenForBookings: boolean = true;

  /// Profile visibility
  @Prop({ default: true })
  isProfileVisible: boolean = true;

  /// Profile completeness percentage (0-100)
  @Prop({ default: 0, min: 0, max: 100 })
  profileCompleteness: number = 0;

  /// Has completed profile setup
  @Prop({ default: false })
  hasCompletedSetup: boolean = false;

  /// Subscription tier
  @Prop({ default: 'free' })
  subscriptionTier: string = 'free';

  @Prop({ type: Date })
  subscriptionExpiresAt?: Date;

  /// Last active timestamp
  @Prop({ type: Date })
  lastActiveAt?: Date;

  /// Profile views count
  @Prop({ default: 0 })
  profileViews: number = 0;

  /// Monthly profile views (for analytics)
  @Prop({ type: Number, default: 0 })
  monthlyViews: number = 0;

  /// Stripe connected account for payouts
  @Prop({ select: false })
  stripeAccountId?: string;

  /// Stripe onboarding status
  @Prop({ default: false })
  stripeOnboardingComplete: boolean = false;

  /// Tags for search optimization
  @Prop({ type: [String], default: [] })
  searchTags: string[] = [];

  /// Neighborhood/Area for location-based search
  @Prop()
  neighborhood?: string;

  /// Parking instructions
  @Prop()
  parkingInstructions?: string;

  /// Public transportation nearby
  @Prop()
  publicTransitInfo?: string;

  /// Covid/safety protocols
  @Prop()
  safetyProtocols?: string;

  /// Insurance requirements
  @Prop()
  insuranceRequirements?: string;

  /// Sample events held
  @Prop({ type: [String], default: [] })
  eventTypes: string[] = [];

  /// Notable past performances
  @Prop({ type: [String], default: [] })
  notablePerformers: string[] = [];

  /// Average crowd size
  @Prop({ default: 'medium' })
  averageCrowdSize: string = 'medium';

  /// Age demographic
  @Prop({ type: [String], default: [] })
  ageDemographics: string[] = [];

  /// Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export type VenueDocument = Venue & Document;
export const VenueSchema = SchemaFactory.createForClass(Venue);

// Enable virtuals in JSON output
VenueSchema.set('toJSON', { virtuals: true });
VenueSchema.set('toObject', { virtuals: true });

// ═══════════════════════════════════════════════════════════════════════════
// INDEXES FOR PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

VenueSchema.index({ userId: 1 }, { unique: true });
VenueSchema.index({
  venueName: 'text',
  description: 'text',
  searchTags: 'text',
});
VenueSchema.index({ venueType: 1 });
VenueSchema.index({ 'location.coordinates': '2dsphere' });
VenueSchema.index({
  'location.city': 1,
  'location.state': 1,
  'location.country': 1,
});
VenueSchema.index({ isVerified: 1, isProfileVisible: 1 });
VenueSchema.index({ hasCompletedSetup: 1 });
VenueSchema.index({ isOpenForBookings: 1 });
VenueSchema.index({ preferredGenres: 1 });
VenueSchema.index({ budgetMin: 1, budgetMax: 1 });
VenueSchema.index({ capacity: 1 });
VenueSchema.index({ 'reviewStats.averageRating': -1 });
VenueSchema.index({ totalGigsHosted: -1 });
VenueSchema.index({ createdAt: -1 });

// Compound indexes for common queries
VenueSchema.index({
  isProfileVisible: 1,
  hasCompletedSetup: 1,
  preferredGenres: 1,
});
VenueSchema.index({ isVerified: 1, 'reviewStats.averageRating': -1 });
VenueSchema.index({ isOpenForBookings: 1, budgetMin: 1, budgetMax: 1 });

// ═══════════════════════════════════════════════════════════════════════════
// VIRTUALS & METHODS
// ═══════════════════════════════════════════════════════════════════════════

/// Virtual for full location string
VenueSchema.virtual('fullLocation').get(function (): string {
  if (!this.location) return '';
  const parts = [
    this.location.streetAddress,
    this.location.city,
    this.location.state,
    this.location.postalCode,
    this.location.country,
  ].filter(Boolean);
  return parts.join(', ');
});

/// Virtual for checking if venue is open today
VenueSchema.virtual('isOpenToday').get(function (): boolean {
  const today = new Date().getDay();
  return this.operatingHours?.some((h) => h.dayOfWeek === today && h.isOpen) ?? false;
});

/// Virtual for primary contact
VenueSchema.virtual('primaryContact').get(function (): ContactPerson | null {
  return this.contacts?.find((c) => c.isPrimary) || this.contacts?.[0] || null;
});

/// Virtual for primary photo
VenueSchema.virtual('primaryPhoto').get(function (): string | null {
  const primary = this.photos?.find((p) => p.isPrimary);
  return primary?.url || this.photos?.[0]?.url || null;
});

/// Virtual for profile photo URL (alias for primaryPhoto for Flutter compatibility)
VenueSchema.virtual('profilePhotoUrl').get(function (): string | null {
  const primary = this.photos?.find((p) => p.isPrimary);
  return primary?.url || this.photos?.[0]?.url || null;
});

/// Virtual for gallery URLs (non-primary photos for Flutter compatibility)
VenueSchema.virtual('galleryUrls').get(function (): string[] {
  return (this.photos || [])
    .filter((p) => !p.isPrimary)
    .sort((a, b) => a.order - b.order)
    .map((p) => p.url);
});

/// Calculate profile completeness
VenueSchema.methods.calculateProfileCompleteness = function (): number {
  let score = 0;
  const maxScore = 100;

  // Basic info (25 points)
  if (this.venueName) score += 5;
  if (this.description && this.description.length >= 100) score += 10;
  if (this.venueType && this.venueType !== VenueType.OTHER) score += 5;
  if (this.tagline) score += 5;

  // Location (15 points)
  if (this.location?.city) score += 5;
  if (this.location?.streetAddress) score += 5;
  if (this.location?.coordinates) score += 5;

  // Contact (15 points)
  if (this.phone) score += 5;
  if (this.contactEmail) score += 5;
  if (this.contacts.length > 0) score += 5;

  // Media (20 points)
  if (this.photos.length > 0) score += 10;
  if (this.photos.length >= 3) score += 5;
  if (this.virtualTourUrl) score += 5;

  // Equipment (10 points)
  if (this.equipment.hasSoundSystem) score += 5;
  if (this.equipment.hasStage) score += 5;

  // Preferences (10 points)
  if (this.preferredGenres.length > 0) score += 5;
  if (this.budgetMin > 0 || this.budgetMax > 0) score += 5;

  // Social (5 points)
  if (this.socialLinks?.website) score += 5;

  return Math.min(score, maxScore);
};

/// Update review stats after a new review
VenueSchema.methods.updateReviewStats = function (): void {
  if (this.reviewStats.totalReviews === 0) {
    this.reviewStats.averageRating = 0;
    return;
  }

  // Calculate weighted average
  const totalWeight =
    this.reviewStats.fiveStarCount * 5 +
    this.reviewStats.fourStarCount * 4 +
    this.reviewStats.threeStarCount * 3 +
    this.reviewStats.twoStarCount * 2 +
    this.reviewStats.oneStarCount * 1;

  this.reviewStats.averageRating = totalWeight / this.reviewStats.totalReviews;
  this.reviewStats.averageRating =
    Math.round(this.reviewStats.averageRating * 10) / 10;
};

/// Check if venue can accept new booking on given date
VenueSchema.methods.canAcceptBooking = function (date: Date): boolean {
  // Check if date is in the future
  if (date < new Date()) return false;

  // Check operating hours
  const dayOfWeek = date.getDay();
  const dayHours = this.operatingHours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!dayHours || !dayHours.isOpen) return false;

  // Check booking lead time
  const leadTimeMs = this.bookingLeadTimeDays * 24 * 60 * 60 * 1000;
  if (date.getTime() - Date.now() < leadTimeMs) return false;

  return true;
};

/// Get available gig slots for a date
VenueSchema.methods.getAvailableSlots = function (date: Date): number {
  const dayGigs = this.gigs.filter(
    (g) =>
      g.date.toDateString() === date.toDateString() &&
      g.status === GigStatus.OPEN,
  );
  return this.slotsAvailable - dayGigs.length;
};

/// Pre-save hook to calculate profile completeness and set hasCompletedSetup
VenueSchema.pre('save', function (this: VenueDocument) {
  // Calculate profile completeness
  let score = 0;
  const maxScore = 100;

  // Basic info (25 points)
  if (this.venueName) score += 5;
  if (this.description && this.description.length >= 100) score += 10;
  if (this.venueType && this.venueType !== VenueType.OTHER) score += 5;
  if (this.tagline) score += 5;

  // Location (15 points)
  if (this.location?.city) score += 5;
  if (this.location?.streetAddress) score += 5;
  if (this.location?.coordinates &&
      this.location!.coordinates.length >= 2 &&
      this.location!.coordinates[0] !== 0 &&
      this.location!.coordinates[1] !== 0) score += 5;

  // Contact (15 points)
  if (this.phone) score += 5;
  if (this.contactEmail) score += 5;
  if (this.contacts.length > 0) score += 5;

  // Media (20 points)
  if (this.photos.length > 0) score += 10;
  if (this.photos.length >= 3) score += 5;
  if (this.virtualTourUrl) score += 5;

  // Equipment (10 points)
  if (this.equipment.hasSoundSystem) score += 5;
  if (this.equipment.hasStage) score += 5;

  // Preferences (10 points)
  if (this.preferredGenres.length > 0) score += 5;
  if (this.budgetMin > 0 || this.budgetMax > 0) score += 5;

  // Social (5 points)
  if (this.socialLinks?.website) score += 5;

  // Set profile completeness percentage
  this.profileCompleteness = Math.min(score, maxScore);

  // Auto-set hasCompletedSetup when profile is >= 30% complete
  // This allows venues to post gigs once they have name, location, capacity, and budget
  if (this.profileCompleteness >= 30) {
    this.hasCompletedSetup = true;
  } else {
    this.hasCompletedSetup = false;
  }

  // Update search tags
  this.searchTags = [
    this.venueName,
    this.venueType,
    this.location?.city,
    this.location?.state,
    ...this.preferredGenres,
    ...this.gigTypes,
  ].filter(Boolean) as string[];
});

/// Instance method to get public profile (hide sensitive data)
VenueSchema.methods.toPublicProfile = function () {
  return {
    id: this._id.toString(),
    venueName: this.venueName,
    venueType: this.venueType,
    tagline: this.tagline,
    description: this.description,
    location: this.location
      ? {
          city: this.location.city,
          state: this.location.state,
          country: this.location.country,
          neighborhood: this.neighborhood,
        }
      : null,
    capacity: this.capacity,
    preferredGenres: this.preferredGenres,
    equipment: {
      hasSoundSystem: this.equipment.hasSoundSystem,
      hasLighting: this.equipment.hasLighting,
      hasStage: this.equipment.hasStage,
      hasDressingRoom: this.equipment.hasDressingRoom,
      hasParking: this.equipment.hasParking,
      isWheelchairAccessible: this.equipment.isWheelchairAccessible,
    },
    photos: this.photos.map((p: any) => ({
      url: p.url,
      caption: p.caption,
    })),
    reviewStats: this.reviewStats,
    isVerified: this.isVerified,
    totalGigsHosted: this.totalGigsHosted,
    averageRating: this.reviewStats.averageRating,
    isOpenForBookings: this.isOpenForBookings,
  };
};

/// Instance method to get searchable data
VenueSchema.methods.toSearchable = function () {
  return {
    objectID: this._id.toString(),
    venueName: this.venueName,
    venueType: this.venueType,
    genres: this.preferredGenres,
    city: this.location?.city,
    state: this.location?.state,
    country: this.location?.country,
    coordinates: this.location?.coordinates,
    budgetMin: this.budgetMin,
    budgetMax: this.budgetMax,
    currency: this.currency,
    capacity: this.capacity,
    averageRating: this.reviewStats.averageRating,
    isVerified: this.isVerified,
    isOpenForBookings: this.isOpenForBookings,
    profileCompleteness: this.profileCompleteness,
    subscriptionTier: this.subscriptionTier,
    totalGigsHosted: this.totalGigsHosted,
  };
};

