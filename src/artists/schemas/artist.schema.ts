/// 🎸 GIGMATCH ARTIST SCHEMA
///
/// Comprehensive artist profile model for the gig matching platform
/// Includes all fields needed for discovery, matching, and booking

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

export enum ArtistType {
  SOLO = 'solo',
  BAND = 'band',
  DUO = 'duo',
  DJ = 'dj',
  PRODUCER = 'producer',
  instrumentalist = 'instrumentalist',
}

export enum ExperienceLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  PROFESSIONAL = 'professional',
  touring = 'touring',
}

export enum AvailabilityStatus {
  AVAILABLE = 'available',
  LIMITED = 'limited',
  UNAVAILABLE = 'unavailable',
  ON_TOUR = 'on_tour',
}

// ═══════════════════════════════════════════════════════════════════════════
// EMBEDDED SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/// Social media links for artist
@Schema({ _id: false })
export class SocialLinks {
  @Prop()
  instagram?: string;

  @Prop()
  spotify?: string;

  @Prop()
  youtube?: string;

  @Prop()
  soundcloud?: string;

  @Prop()
  tiktok?: string;

  @Prop()
  website?: string;

  @Prop()
  appleMusic?: string;

  @Prop()
  bandcamp?: string;
}

export const SocialLinksSchema = SchemaFactory.createForClass(SocialLinks);

/// Location with GeoJSON coordinates for radius-based discovery
@Schema({ _id: false })
export class ArtistLocation {
  @Prop({ type: String, default: 'Point' })
  type: string = 'Point';

  @Prop({ type: [Number], default: [0, 0] })
  coordinates: [number, number] = [0, 0]; // [longitude, latitude]

  @Prop()
  city?: string;

  @Prop()
  state?: string;

  @Prop()
  country?: string;

  @Prop()
  formattedAddress?: string;

  @Prop({ default: 50 })
  travelRadiusMiles: number = 50;
}

export const ArtistLocationSchema =
  SchemaFactory.createForClass(ArtistLocation);

/// Individual availability slot
@Schema({ _id: true })
export class AvailabilitySlot {
  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: Date })
  startTime?: Date;

  @Prop({ type: Date })
  endTime?: Date;

  @Prop({ default: false })
  isBooked: boolean = false;

  @Prop()
  bookedBy?: Types.ObjectId;

  @Prop()
  gigId?: string;

  @Prop({ default: AvailabilityStatus.AVAILABLE })
  status: AvailabilityStatus = AvailabilityStatus.AVAILABLE;

  @Prop()
  notes?: string;
}

export const AvailabilitySlotSchema =
  SchemaFactory.createForClass(AvailabilitySlot);

/// Audio sample embedded document
@Schema({ _id: true })
export class AudioSample {
  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  url!: string;

  @Prop({ required: true })
  durationSeconds!: number;

  @Prop({ default: 0 })
  playCount: number = 0;

  @Prop({ default: false })
  isFeatured: boolean = false;

  @Prop({ type: Date, default: Date.now })
  uploadedAt: Date = new Date();
}

export const AudioSampleSchema = SchemaFactory.createForClass(AudioSample);

/// Video sample embedded document
@Schema({ _id: true })
export class VideoSample {
  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  url!: string;

  @Prop()
  thumbnailUrl?: string;

  @Prop({ default: 0 })
  durationSeconds: number = 0;

  @Prop({ default: 0 })
  viewCount: number = 0;

  @Prop({ default: false })
  isFeatured: boolean = false;

  @Prop({ type: Date, default: Date.now })
  uploadedAt: Date = new Date();
}

export const VideoSampleSchema = SchemaFactory.createForClass(VideoSample);

/// Photo gallery embedded document
@Schema({ _id: true })
export class Photo {
  @Prop({ required: true })
  url!: string;

  @Prop()
  thumbnailUrl?: string;

  @Prop()
  caption?: string;

  @Prop({ default: false })
  isProfilePhoto: boolean = false;

  @Prop({ default: 0 })
  order: number = 0;

  @Prop({ type: Date, default: Date.now })
  uploadedAt: Date = new Date();
}

export const PhotoSchema = SchemaFactory.createForClass(Photo);

/// Review statistics summary
@Schema({ _id: false })
export class ReviewStats {
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
}

export const ReviewStatsSchema = SchemaFactory.createForClass(ReviewStats);

/// Reputation score breakdown
@Schema({ _id: false })
export class ReputationScore {
  @Prop({ default: 0.0 })
  overall: number = 0.0;

  @Prop({ default: 0.0 })
  reliability: number = 0.0;

  @Prop({ default: 0.0 })
  performanceQuality: number = 0.0;

  @Prop({ default: 0.0 })
  audienceFeedback: number = 0.0;

  @Prop({ default: 0.0 })
  professionalism: number = 0.0;

  @Prop({ type: [Number], default: [0, 0, 0, 0, 0] })
  scoreHistory: number[] = [0, 0, 0, 0, 0]; // Last 5 gig scores

  @Prop({ type: Date })
  lastCalculated?: Date;
}

export const ReputationScoreSchema =
  SchemaFactory.createForClass(ReputationScore);

/// Past booking reference for reputation
@Schema({ _id: true })
export class PastBooking {
  @Prop({ type: Types.ObjectId, ref: 'Venue', required: true })
  venueId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Gig' })
  gigId?: Types.ObjectId;

  @Prop({ required: true })
  venueName!: string;

  @Prop({ type: Date, required: true })
  gigDate!: Date;

  @Prop({ default: false })
  wasCompleted: boolean = false;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop()
  cancellationReason?: string;
}

export const PastBookingSchema = SchemaFactory.createForClass(PastBooking);

/// Touring location for traveling musicians
@Schema({ _id: true })
export class TourLocation {
  @Prop({ required: true })
  city!: string;

  @Prop()
  state?: string;

  @Prop({ required: true })
  country!: string;

  @Prop({ required: true })
  startDate!: Date;

  @Prop({ required: true })
  endDate!: Date;

  @Prop({ default: 50 })
  travelRadiusMiles: number = 50;

  @Prop({ type: [Number] })
  coordinates?: [number, number];

  @Prop({ default: true })
  isActive: boolean = true;

  @Prop()
  notes?: string;
}

export const TourLocationSchema = SchemaFactory.createForClass(TourLocation);

/// Influences tag for recommendation system
@Schema({ _id: false })
export class Influence {
  @Prop({ required: true })
  name!: string;

  @Prop()
  genre?: string;

  @Prop({ default: 1 })
  relevanceScore: number = 1;
}

export const InfluenceSchema = SchemaFactory.createForClass(Influence);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ARTIST SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

@Schema({ timestamps: true, collection: 'artists' })
export class Artist {
  _id: Types.ObjectId;

  /// Reference to User account
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  /// Display name (can be different from user name)
  @Prop({ required: true, trim: true, maxlength: 100 })
  displayName!: string;

  /// Stage name (optional, for bands/solo artists with stage persona)
  @Prop({ trim: true, maxlength: 100 })
  stageName?: string;

  /// Artist type
  @Prop({
    enum: ArtistType,
    type: String,
    default: ArtistType.SOLO,
  })
  artistType: ArtistType = ArtistType.SOLO;

  /// Bio/description
  @Prop({ maxlength: 2000 })
  bio?: string;

  /// Musical genres (multi-select, max 5)
  @Prop({ type: [String], default: [] })
  genres: string[] = [];

  /// Influences/artists that inspire this artist
  @Prop({ type: [String], default: [] })
  influences: string[] = [];

  /// Contact phone number
  @Prop()
  phone?: string;

  /// Show phone on public profile
  @Prop({ default: false })
  showPhoneOnProfile: boolean = false;

  /// Email (can be different from account email)
  @Prop()
  email?: string;

  /// Social media links
  @Prop({ type: SocialLinks })
  socialLinks?: SocialLinks;

  /// Location data with GeoJSON coordinates
  @Prop({ type: ArtistLocation })
  location?: ArtistLocation;

  /// Travel radius for gigs (miles)
  @Prop({ default: 50, min: 5, max: 500 })
  travelRadiusMiles: number = 50;

  /// Profile photo URL
  @Prop()
  profilePhotoUrl?: string;

  /// Photo gallery
  @Prop({ type: [Photo], default: [] })
  photos: Photo[] = [];

  /// Audio samples (songs, demos)
  @Prop({ type: [AudioSample], default: [] })
  audioSamples: AudioSample[] = [];

  /// Video samples (performances, music videos)
  @Prop({ type: [VideoSample], default: [] })
  videoSamples: VideoSample[] = [];

  /// Set list duration in minutes
  @Prop({ default: 60, min: 15, max: 480 })
  setDurationMinutes: number = 60;

  /// Price range
  @Prop({ type: Number, default: 0 })
  minPrice: number = 0;

  @Prop({ type: Number, default: 0 })
  maxPrice: number = 0;

  @Prop({ default: 'USD' })
  currency: string = 'USD';

  /// Equipment provided by artist
  @Prop({ type: [String], default: [] })
  equipmentProvided: string[] = [];

  /// Equipment needed from venue
  @Prop({ type: [String], default: [] })
  equipmentNeeded: string[] = [];

  /// Availability slots
  @Prop({ type: [AvailabilitySlot], default: [] })
  availability: AvailabilitySlot[] = [];

  /// Experience level
  @Prop({
    enum: ExperienceLevel,
    type: String,
    default: ExperienceLevel.INTERMEDIATE,
  })
  experienceLevel: ExperienceLevel = ExperienceLevel.INTERMEDIATE;

  /// Years of experience
  @Prop({ min: 0, max: 50 })
  yearsExperience?: number;

  /// Number of gigs performed
  @Prop({ default: 0 })
  totalGigsPerformed: number = 0;

  /// Past bookings for reputation
  @Prop({ type: [PastBooking], default: [] })
  pastBookings: PastBooking[] = [];

  /// Review statistics
  @Prop({ type: ReviewStats, default: () => new ReviewStats() })
  reviewStats: ReviewStats = new ReviewStats();

  /// Reputation score breakdown
  @Prop({ type: ReputationScore, default: () => new ReputationScore() })
  reputation: ReputationScore = new ReputationScore();

  /// Verified artist status
  @Prop({ default: false })
  isVerified: boolean = false;

  @Prop({ type: Date })
  verifiedAt?: Date;

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

  /// Boost settings
  @Prop({ default: false })
  isBoosted: boolean = false;

  @Prop({ type: Date })
  boostExpiresAt?: Date;

  /// Last active timestamp
  @Prop({ type: Date })
  lastActiveAt?: Date;

  /// Profile views count
  @Prop({ default: 0 })
  profileViews: number = 0;

  /// Monthly profile views (for analytics)
  @Prop({ type: Number, default: 0 })
  monthlyViews: number = 0;

  /// Tour locations for traveling musicians
  @Prop({ type: [TourLocation], default: [] })
  tourLocations: TourLocation[] = [];

  /// Current active tour location
  @Prop({ type: TourLocation })
  activeTourLocation?: TourLocation;

  /// Tags for search optimization
  @Prop({ type: [String], default: [] })
  searchTags: string[] = [];

  /// Collaborators (for bands)
  @Prop({ type: [String], default: [] })
  memberNames: string[] = [];

  /// Sample set list (songs performed)
  @Prop({ type: [String], default: [] })
  sampleSetlist: string[] = [];

  /// Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export type ArtistDocument = Artist & Document;
export const ArtistSchema = SchemaFactory.createForClass(Artist);

// ═══════════════════════════════════════════════════════════════════════════
// INDEXES FOR PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

ArtistSchema.index({ userId: 1 }, { unique: true });
ArtistSchema.index({ displayName: 'text', bio: 'text', searchTags: 'text' });
ArtistSchema.index({ genres: 1 });
ArtistSchema.index({ 'location.coordinates': '2dsphere' });
ArtistSchema.index({ 'location.city': 1, 'location.country': 1 });
ArtistSchema.index({ isVerified: 1, isProfileVisible: 1 });
ArtistSchema.index({ hasCompletedSetup: 1 });
ArtistSchema.index({ isBoosted: 1, boostExpiresAt: 1 });
ArtistSchema.index({ subscriptionTier: 1 });
ArtistSchema.index({ 'reviewStats.averageRating': -1 });
ArtistSchema.index({ 'reputation.overall': -1 });
ArtistSchema.index({ minPrice: 1, maxPrice: 1 });
ArtistSchema.index({ artistType: 1 });
ArtistSchema.index({ experienceLevel: 1 });
ArtistSchema.index({ totalGigsPerformed: -1 });
ArtistSchema.index({ createdAt: -1 });

// Compound indexes for common queries
ArtistSchema.index({ isProfileVisible: 1, hasCompletedSetup: 1, genres: 1 });
ArtistSchema.index({ isVerified: 1, 'reviewStats.averageRating': -1 });

// ═══════════════════════════════════════════════════════════════════════════
// VIRTUALS & METHODS
// ═══════════════════════════════════════════════════════════════════════════

/// Virtual for full name (display name or stage name)
ArtistSchema.virtual('fullName').get(function (): string {
  return this.stageName || this.displayName;
});

/// Virtual for checking if currently available
ArtistSchema.virtual('isAvailable').get(function (): boolean {
  return this.availability.some(
    (slot) =>
      slot.date > new Date() && slot.status === AvailabilityStatus.AVAILABLE,
  );
});

/// Virtual for primary genre
ArtistSchema.virtual('primaryGenre').get(function (): string | null {
  return this.genres.length > 0 ? this.genres[0] : null;
});

/// Calculate profile completeness
ArtistSchema.methods.calculateProfileCompleteness = function (): number {
  let score = 0;
  const maxScore = 100;

  // Basic info (30 points)
  if (this.displayName) score += 5;
  if (this.bio && this.bio.length >= 100) score += 10;
  if (this.bio && this.bio.length >= 500) score += 5;
  if (this.genres.length > 0) score += 10;

  // Media (25 points)
  if (this.profilePhotoUrl) score += 10;
  if (this.photos.length >= 3) score += 5;
  if (this.audioSamples.length >= 1) score += 5;
  if (this.videoSamples.length >= 1) score += 5;

  // Location (15 points)
  if (this.location?.city) score += 5;
  if (this.location?.coordinates) score += 10;

  // Contact (10 points)
  if (this.phone) score += 5;
  if (this.socialLinks?.spotify) score += 5;

  // Pricing (10 points)
  if (this.minPrice > 0) score += 5;
  if (this.maxPrice > this.minPrice) score += 5;

  // Availability (10 points)
  if (this.availability.length > 0) score += 10;

  return Math.min(score, maxScore);
};

/// Update reputation based on recent reviews
ArtistSchema.methods.updateReputation = function (): void {
  if (this.reviewStats.totalReviews === 0) {
    this.reputation.overall = 0;
    return;
  }

  // Simple reputation calculation based on average rating
  const baseScore = this.reviewStats.averageRating * 20; // Convert to 0-100 scale
  const reliabilityBoost = this.totalGigsPerformed > 10 ? 5 : 0;
  const verifiedBoost = this.isVerified ? 5 : 0;

  this.reputation.overall = Math.min(
    100,
    baseScore + reliabilityBoost + verifiedBoost,
  );
  this.reputation.performanceQuality = this.reviewStats.averageRating * 20;
  this.reputation.lastCalculated = new Date();
};

/// Check if artist is touring
ArtistSchema.methods.isOnTour = function (): boolean {
  if (!this.activeTourLocation) return false;
  const now = new Date();
  return (
    this.activeTourLocation.startDate <= now &&
    this.activeTourLocation.endDate >= now
  );
};

/// Get active location (home or tour)
ArtistSchema.methods.getActiveLocation = function (): ArtistLocation | null {
  if (this.isOnTour() && this.activeTourLocation) {
    return {
      type: 'Point',
      coordinates: this.activeTourLocation.coordinates ||
        this.location?.coordinates || [0, 0],
      city: this.activeTourLocation.city,
      state: this.activeTourLocation.state,
      country: this.activeTourLocation.country,
      travelRadiusMiles: this.activeTourLocation.travelRadiusMiles,
    };
  }
  return this.location || null;
};

/// Pre-save hook to calculate profile completeness
ArtistSchema.pre('save', function () {
  if (
    this.isModified('displayName') ||
    this.isModified('bio') ||
    this.isModified('genres') ||
    this.isModified('profilePhotoUrl') ||
    this.isModified('photos') ||
    this.isModified('audioSamples') ||
    this.isModified('videoSamples') ||
    this.isModified('location') ||
    this.isModified('phone') ||
    this.isModified('socialLinks') ||
    this.isModified('minPrice') ||
    this.isModified('maxPrice') ||
    this.isModified('availability')
  ) {
    this.profileCompleteness = (this as any).calculateProfileCompleteness();
    this.hasCompletedSetup = this.profileCompleteness >= 80;
  }
});

/// Instance method to get public profile (hide sensitive data)
ArtistSchema.methods.toPublicProfile = function () {
  return {
    id: this._id.toString(),
    displayName: this.displayName,
    stageName: this.stageName,
    artistType: this.artistType,
    bio: this.bio,
    genres: this.genres,
    influences: this.influences,
    location: this.location
      ? {
          city: this.location.city,
          state: this.location.state,
          country: this.location.country,
          travelRadiusMiles: this.location.travelRadiusMiles,
        }
      : null,
    profilePhotoUrl: this.profilePhotoUrl,
    photoCount: this.photos.length,
    audioSampleCount: this.audioSamples.length,
    videoSampleCount: this.videoSamples.length,
    minPrice: this.minPrice,
    maxPrice: this.maxPrice,
    currency: this.currency,
    reviewStats: this.reviewStats,
    reputation: {
      overall: this.reputation.overall,
      reliability: this.reputation.reliability,
      performanceQuality: this.reputation.performanceQuality,
    },
    isVerified: this.isVerified,
    totalGigsPerformed: this.totalGigsPerformed,
    experienceLevel: this.experienceLevel,
    memberNames: this.memberNames,
    sampleSetlist: this.sampleSetlist,
  };
};

/// Instance method to get searchable data
ArtistSchema.methods.toSearchable = function () {
  return {
    objectID: this._id.toString(),
    displayName: this.displayName,
    stageName: this.stageName,
    genres: this.genres,
    bio: this.bio,
    city: this.location?.city,
    country: this.location?.country,
    coordinates: this.location?.coordinates,
    travelRadiusMiles:
      this.location?.travelRadiusMiles || this.travelRadiusMiles,
    minPrice: this.minPrice,
    maxPrice: this.maxPrice,
    currency: this.currency,
    averageRating: this.reviewStats.averageRating,
    isVerified: this.isVerified,
    isAvailable: this.isAvailable,
    profileCompleteness: this.profileCompleteness,
    subscriptionTier: this.subscriptionTier,
  };
};


