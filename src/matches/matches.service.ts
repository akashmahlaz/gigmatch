import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Match, MatchDocument } from '../schemas/match.schema';
import { Artist, ArtistDocument } from '../schemas/artist.schema';
import { Venue, VenueDocument } from '../schemas/venue.schema';
import { GetMatchesDto, UpdateMatchDto, MatchWithDetailsDto } from './dto/match.dto';

@Injectable()
export class MatchesService {
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
  ): Promise<{ matches: MatchWithDetailsDto[]; total: number; page: number; pages: number }> {
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
  async markAsViewed(matchId: string, userId: string, userRole: string): Promise<void> {
    const match = await this.getMatchById(matchId, userId);

    if (userRole === 'artist') {
      match.artistLastViewedAt = new Date();
      match.unreadCount.artist = 0;
    } else {
      match.venueLastViewedAt = new Date();
      match.unreadCount.venue = 0;
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
   * Update last message info
   */
  async updateLastMessage(
    matchId: string,
    content: string,
  ): Promise<void> {
    await this.matchModel.findByIdAndUpdate(matchId, {
      hasMessages: true,
      lastMessageAt: new Date(),
      lastMessagePreview:
        content.length > 50 ? content.substring(0, 50) + '...' : content,
    });
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
   */
  private async enrichMatch(
    match: MatchDocument,
    userId: string,
    userRole: string,
  ): Promise<MatchWithDetailsDto> {
    const isArtist = match.artistUser.toString() === userId;
    const otherProfileId = isArtist ? match.venue : match.artist;
    const otherType = isArtist ? 'venue' : 'artist';

    let otherUser: MatchWithDetailsDto['otherUser'];

    if (otherType === 'artist') {
      const artist = await this.artistModel.findById(otherProfileId).exec();
      otherUser = {
        id: match.artistUser.toString(),
        name: artist?.displayName || 'Unknown Artist',
        profilePhoto: artist?.profilePhoto,
        type: 'artist',
        profileId: otherProfileId.toString(),
      };
    } else {
      const venue = await this.venueModel.findById(otherProfileId).exec();
      otherUser = {
        id: match.venueUser.toString(),
        name: venue?.venueName || 'Unknown Venue',
        profilePhoto: venue?.coverPhoto,
        type: 'venue',
        profileId: otherProfileId.toString(),
      };
    }

    const unreadCount = isArtist
      ? match.unreadCount.artist
      : match.unreadCount.venue;

    return {
      id: match._id.toString(),
      matchedAt: match.createdAt || new Date(),
      status: match.status,
      otherUser,
      lastMessage: match.hasMessages
        ? {
            content: match.lastMessagePreview || '',
            sentAt: match.lastMessageAt!,
            isRead: unreadCount === 0,
          }
        : undefined,
      unreadCount,
    };
  }
}
