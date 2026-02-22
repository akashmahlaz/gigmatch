import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Match, MatchDocument } from '../schemas/match.schema';
import { Artist, ArtistDocument } from '../artists/schemas/artist.schema';
import { Venue, VenueDocument } from '../venues/schemas/venue.schema';
import {
  GetMatchesDto,
  UpdateMatchDto,
  MatchWithDetailsDto,
} from './dto/match.dto';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(Artist.name) private artistModel: Model<ArtistDocument>,
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
  ) {}

  /**
   * Get all matches for a user
   */
  async getMatches(
    userId: string,
    userRole: string,
    queryDto: GetMatchesDto,
  ): Promise<{
    matches: MatchWithDetailsDto[];
    total: number;
    page: number;
    pages: number;
  }> {
    const { status = 'active', page = 1, limit = 20 } = queryDto;

    const filter: any = {
      status,
      $or: [{ artistUser: userId }, { venueUser: userId }],
    };

    const skip = (page - 1) * limit;

    const [matches, total] = await Promise.all([
      this.matchModel
        .find(filter)
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.matchModel.countDocuments(filter).exec(),
    ]);

    // Enrich with user details
    const enrichedMatches = await Promise.all(
      matches.map(async (match) => this.enrichMatch(match, userId, userRole)),
    );

    return {
      matches: enrichedMatches,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single match by ID
   */
  async getMatchById(matchId: string, userId: string): Promise<MatchDocument> {
    const match = await this.matchModel.findById(matchId).exec();

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    // Verify user is part of this match
    if (
      match.artistUser.toString() !== userId &&
      match.venueUser.toString() !== userId
    ) {
      throw new ForbiddenException('Access denied');
    }

    return match;
  }

  /**
   * Get a single match by ID with enriched details (otherUser)
   */
  async getMatchByIdEnriched(
    matchId: string,
    userId: string,
    userRole: string,
  ): Promise<MatchWithDetailsDto> {
    const match = await this.getMatchById(matchId, userId);
    return this.enrichMatch(match, userId, userRole);
  }

  /**
   * Update match (archive, block)
   */
  async updateMatch(
    matchId: string,
    userId: string,
    updateDto: UpdateMatchDto,
  ): Promise<MatchDocument> {
    const match = await this.getMatchById(matchId, userId);

    if (updateDto.status) {
      match.status = updateDto.status as any;
    }

    await match.save();
    return match;
  }

  /**
   * Mark match as viewed
   */
  async markAsViewed(
    matchId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const match = await this.getMatchById(matchId, userId);

    if (userRole === 'artist') {
      match.artistLastViewedAt = new Date();
      match.unreadCount = { ...match.unreadCount, artist: 0 };
    } else {
      match.venueLastViewedAt = new Date();
      match.unreadCount = { ...match.unreadCount, venue: 0 };
    }

    await match.save();
  }

  /**
   * Get unread matches count
   */
  async getUnreadCount(userId: string, userRole: string): Promise<number> {
    const filter: any = {
      status: 'active',
    };

    if (userRole === 'artist') {
      filter.artistUser = userId;
      filter['unreadCount.artist'] = { $gt: 0 };
    } else {
      filter.venueUser = userId;
      filter['unreadCount.venue'] = { $gt: 0 };
    }

    return this.matchModel.countDocuments(filter).exec();
  }

  /**
   * Increment unread count for recipient
   */
  async incrementUnread(
    matchId: string,
    recipientRole: 'artist' | 'venue',
  ): Promise<void> {
    const updateField =
      recipientRole === 'artist' ? 'unreadCount.artist' : 'unreadCount.venue';

    await this.matchModel.findByIdAndUpdate(matchId, {
      $inc: { [updateField]: 1 },
    });
  }

  /**
   * Update last message info (message-type-aware preview)
   */
  async updateLastMessage(
    matchId: string,
    content: string,
    messageType?: string,
  ): Promise<void> {
    const preview = this.getMessagePreview(content, messageType);
    this.logger.log(`📝 [updateLastMessage] matchId=${matchId} type=${messageType} preview="${preview}"`);
    await this.matchModel.findByIdAndUpdate(matchId, {
      hasMessages: true,
      lastMessageAt: new Date(),
      lastMessagePreview: preview,
    });
  }

  /**
   * Generate user-friendly message preview based on type
   */
  private getMessagePreview(content: string, messageType?: string): string {
    // For non-text message types, show a friendly label instead of raw content/URL
    switch (messageType) {
      case 'image':
        return '📷 Photo';
      case 'audio':
        return '🎵 Audio message';
      case 'booking_request':
        return '📋 Booking request';
      case 'booking_update':
        return '📋 Booking update';
      case 'system':
        return '📌 System notice';
      default:
        break;
    }
    // For text messages, check if content looks like a URL (media sent as text type)
    if (content && (content.startsWith('http://') || content.startsWith('https://'))) {
      if (/\.(jpg|jpeg|png|gif|webp|heic|avif)/i.test(content)) {
        return '📷 Photo';
      }
      if (/\.(mp3|wav|m4a|aac|ogg|opus)/i.test(content)) {
        return '🎵 Audio message';
      }
      if (/\.(mp4|mov|avi|webm)/i.test(content)) {
        return '🎬 Video';
      }
      // Generic URL/file attachment
      return '📎 Attachment';
    }
    // Normal text - truncate if needed
    if (!content) return 'Sent a message';
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  }

  /**
   * Convert match to booking
   */
  async convertToBooking(matchId: string, bookingId: string): Promise<void> {
    await this.matchModel.findByIdAndUpdate(matchId, {
      status: 'converted_to_booking',
      booking: bookingId,
    });
  }

  /**
   * Enrich match with other user's details
   * Resolves profile data from User → Artist/Venue chain
   *
   * Field compatibility: User schema may store profile references as either
   * 'artistProfile'/'venueProfile' (schemas/user.schema.ts) or
   * 'artistId'/'venueId' (auth/schemas/user.schema.ts).
   * We check BOTH field names for robustness.
   */
  private async enrichMatch(
    match: MatchDocument,
    userId: string,
    userRole: string,
  ): Promise<MatchWithDetailsDto> {
    const matchId = match._id.toString();
    const isArtist = match.artistUser?.toString() === userId;
    const otherType = isArtist ? 'venue' : 'artist';

    this.logger.log(
      `🔍 [enrichMatch] matchId=${matchId} userId=${userId} role=${userRole} ` +
      `artistUser=${match.artistUser} venueUser=${match.venueUser} otherType=${otherType}`,
    );

    let otherUser: MatchWithDetailsDto['otherUser'];

    if (otherType === 'artist') {
      // Current user is venue → other party is artist
      const artistUser = await this.matchModel.db.collection('users').findOne({
        _id: match.artistUser,
      });

      this.logger.log(
        `👤 [enrichMatch] Artist user lookup: found=${!!artistUser} ` +
        `role=${artistUser?.role} artistProfile=${artistUser?.artistProfile} ` +
        `artistId=${artistUser?.artistId} fullName=${artistUser?.fullName} name=${artistUser?.name}`,
      );

      // Try both field names: artistProfile (schemas/user.schema) and artistId (auth/schemas/user.schema)
      const otherProfileId =
        artistUser?.artistProfile || artistUser?.artistId || null;

      let artist: ArtistDocument | null = null;
      if (otherProfileId) {
        artist = await this.artistModel.findById(otherProfileId).exec();
        this.logger.log(
          `🎸 [enrichMatch] Artist profile lookup: profileId=${otherProfileId} ` +
          `found=${!!artist} displayName=${artist?.displayName} stageName=${artist?.stageName} ` +
          `photoUrl=${artist?.profilePhotoUrl}`,
        );
      } else {
        // Fallback: try finding artist by userId directly
        artist = await this.artistModel.findOne({ userId: match.artistUser }).exec();
        this.logger.warn(
          `⚠️ [enrichMatch] No artist profile ref on user doc, fallback lookup by userId: ` +
          `found=${!!artist} displayName=${artist?.displayName}`,
        );
      }

      const displayName = artist?.stageName || artist?.displayName || artistUser?.name || artistUser?.fullName || 'Unknown Artist';

      otherUser = {
        id: match.artistUser?.toString() || '',
        name: displayName,
        profilePhoto: artist?.profilePhotoUrl || artistUser?.profilePhotoUrl || undefined,
        type: 'artist',
        profileId: (artist?._id || otherProfileId)?.toString() || '',
      };
    } else {
      // Current user is artist → other party is venue
      const venueUser = await this.matchModel.db.collection('users').findOne({
        _id: match.venueUser,
      });

      this.logger.log(
        `👤 [enrichMatch] Venue user lookup: found=${!!venueUser} ` +
        `role=${venueUser?.role} venueProfile=${venueUser?.venueProfile} ` +
        `venueId=${venueUser?.venueId} fullName=${venueUser?.fullName} name=${venueUser?.name}`,
      );

      // Try both field names: venueProfile (schemas/user.schema) and venueId (auth/schemas/user.schema)
      const otherProfileId =
        venueUser?.venueProfile || venueUser?.venueId || null;

      let venue: VenueDocument | null = null;
      if (otherProfileId) {
        venue = await this.venueModel.findById(otherProfileId).exec();
        this.logger.log(
          `🏢 [enrichMatch] Venue profile lookup: profileId=${otherProfileId} ` +
          `found=${!!venue} venueName=${venue?.venueName} ` +
          `photosCount=${venue?.photos?.length ?? 0}`,
        );
      } else {
        // Fallback: try finding venue by userId directly
        venue = await this.venueModel.findOne({ userId: match.venueUser }).exec();
        this.logger.warn(
          `⚠️ [enrichMatch] No venue profile ref on user doc, fallback lookup by userId: ` +
          `found=${!!venue} venueName=${venue?.venueName}`,
        );
      }

      // Resolve profile photo: primary photo first, then any photo, then user's photo
      const primaryPhoto = venue?.photos?.find((p) => p.isPrimary);
      const venuePhoto =
        primaryPhoto?.url || venue?.photos?.[0]?.url || venueUser?.profilePhotoUrl || undefined;

      const displayName = venue?.venueName || venueUser?.name || venueUser?.fullName || 'Unknown Venue';

      otherUser = {
        id: match.venueUser?.toString() || '',
        name: displayName,
        profilePhoto: venuePhoto,
        type: 'venue',
        profileId: (venue?._id || otherProfileId)?.toString() || '',
      };
    }

    const unreadCount = isArtist
      ? match.unreadCount?.artist || 0
      : match.unreadCount?.venue || 0;

    // Safely get matchedAt date with fallback
    const matchedAtDate =
      (match as any).matchedAt || match.createdAt || new Date();

    // Sanitize lastMessagePreview — detect stale URLs from before the fix
    let lastMessageContent = match.lastMessagePreview || '';
    if (
      lastMessageContent &&
      (lastMessageContent.startsWith('http://') || lastMessageContent.startsWith('https://'))
    ) {
      lastMessageContent = this.getMessagePreview(lastMessageContent);
    }

    this.logger.log(
      `✅ [enrichMatch] matchId=${matchId} → otherUser: name="${otherUser.name}" ` +
      `type=${otherUser.type} profileId=${otherUser.profileId} hasPhoto=${!!otherUser.profilePhoto} ` +
      `unread=${unreadCount} lastMsg="${lastMessageContent}"`,
    );

    return {
      id: match._id.toString(),
      matchedAt: matchedAtDate,
      status: match.status,
      otherUser,
      lastMessage: match.hasMessages
        ? {
            content: lastMessageContent,
            sentAt: match.lastMessageAt || new Date(),
            isRead: unreadCount === 0,
          }
        : undefined,
      unreadCount,
    };
  }
}
