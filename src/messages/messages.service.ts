import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';
import { Match, MatchDocument } from '../schemas/match.schema';
import { Artist, ArtistDocument } from '../artists/schemas/artist.schema';
import { Venue, VenueDocument } from '../venues/schemas/venue.schema';
import { SendMessageDto, GetMessagesDto, MarkMessagesReadDto } from './dto/message.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private readonly uploadUrl: string;

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(Artist.name) private artistModel: Model<ArtistDocument>,
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
    private configService: ConfigService,
  ) {
    this.uploadUrl = this.configService.get<string>('UPLOAD_URL') || '/uploads';
  }

  /**
   * Upload media file to Cloudinary
   */
  async uploadMedia(file: Express.Multer.File): Promise<string> {
    // This is now handled by Cloudinary service
    // Just return a placeholder - actual upload happens in CloudinaryController
    throw new Error('Use CloudinaryController for uploads');
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
  }

  /**
   * Send a message in a match conversation
   */
  async sendMessage(
    userId: string,
    userRole: string,
    sendMessageDto: SendMessageDto,
  ): Promise<MessageDocument> {
    const {
      matchId,
      messageType = 'text',
      content,
      attachments,
      replyTo,
      replyToMessageId,
      metadata,
    } = sendMessageDto;

    // Verify match exists and user is part of it
    const match = await this.verifyMatchAccess(matchId, userId);

    if (!content && (!attachments || attachments.length === 0)) {
      throw new BadRequestException('Message must have content or attachments');
    }

    // Save message and update match (no transaction needed - eventual consistency is fine)
    try {
      // Create message
      const message = new this.messageModel({
        match: matchId,
        sender: userId,
        senderType: userRole,
        messageType,
        content,
        attachments: attachments || [],
        replyTo: replyTo ?? replyToMessageId,
        deliveryStatus: 'sent',
        metadata,
      });

      await message.save();

      // Update match with last message info (message-type-aware preview)
      const recipientField = userRole === 'artist' ? 'unreadCount.venue' : 'unreadCount.artist';
      const preview = this.getMessagePreview(content || '', messageType);
      this.logger.log(
        `📨 [sendMessage] matchId=${matchId} sender=${userId} type=${messageType} ` +
        `preview="${preview}" recipientField=${recipientField}`,
      );
      await this.matchModel.findByIdAndUpdate(
        matchId,
        {
          hasMessages: true,
          lastMessageAt: new Date(),
          lastMessagePreview: preview,
          $inc: { [recipientField]: 1 },
        },
      );

      return message;
    } catch (error) {
      this.logger.error('Failed to send message', error);
      throw new BadRequestException('Failed to send message. Please try again.');
    }
  }

  /**
   * Generate user-friendly message preview based on type
   */
  private getMessagePreview(content: string, messageType?: string): string {
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
    // For text messages, check if content looks like a media URL
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
      return '📎 Attachment';
    }
    if (!content) return 'Sent a message';
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  }

  /**
   * Get messages for a match conversation
   */
  async getMessages(
    userId: string,
    queryDto: GetMessagesDto,
  ): Promise<{ messages: MessageDocument[]; hasMore: boolean }> {
    const { matchId, page = 1, limit = 50, before } = queryDto;

    // Verify access
    await this.verifyMatchAccess(matchId, userId);

    const filter: any = {
      match: matchId,
      isDeleted: false,
    };

    if (before) {
      filter._id = { $lt: new Types.ObjectId(before) };
    }

    const messages = await this.messageModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit + 1) // Fetch one extra to check if there are more
      .exec();

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop(); // Remove the extra message
    }

    // Return in chronological order
    return {
      messages: messages.reverse(),
      hasMore,
    };
  }

  /**
   * Mark messages as read
   */
  async markAsRead(
    userId: string,
    userRole: string,
    markReadDto: MarkMessagesReadDto,
  ): Promise<void> {
    const { matchId, messageIds } = markReadDto;

    // Verify access
    const match = await this.verifyMatchAccess(matchId, userId);

    const filter: any = {
      match: matchId,
      sender: { $ne: userId }, // Only mark other's messages as read
      isRead: false,
    };

    if (messageIds?.length) {
      filter._id = { $in: messageIds };
    }

    await this.messageModel.updateMany(filter, {
      isRead: true,
      readAt: new Date(),
      deliveryStatus: 'read',
    });

    // Reset unread count for this user
    const updateField = userRole === 'artist' ? 'unreadCount.artist' : 'unreadCount.venue';
    await this.matchModel.findByIdAndUpdate(matchId, { [updateField]: 0 });
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(
    messageId: string,
    userId: string,
  ): Promise<void> {
    const message = await this.messageModel.findById(messageId).exec();

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Verify sender
    if (message.sender.toString() !== userId) {
      throw new ForbiddenException('Cannot delete this message');
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = 'sender';
    await message.save();
  }

  /**
   * Get a message by ID
   */
  async getMessageById(messageId: string): Promise<MessageDocument | null> {
    return this.messageModel.findById(messageId).exec();
  }

  /**
   * Search messages
   */
  async searchMessages(
    userId: string,
    query: string,
    matchId?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ messages: MessageDocument[]; hasMore: boolean; total: number }> {
    // Get user's matches
    const matches = await this.matchModel.find({
      $or: [{ artistUser: userId }, { venueUser: userId }],
      status: { $ne: 'blocked' },
    });

    const matchIds = matches.map((m) => m._id);

    // Build search filter
    const filter: any = {
      match: { $in: matchIds },
      isDeleted: false,
      $or: [
        { content: { $regex: query, $options: 'i' } },
        { 'attachments.filename': { $regex: query, $options: 'i' } },
      ],
    };

    if (matchId) {
      filter.match = matchId;
    }

    const [messages, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit + 1)
        .exec(),
      this.messageModel.countDocuments(filter),
    ]);

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop();
    }

    return {
      messages: messages.reverse(),
      hasMore,
      total,
    };
  }

  /**
   * Get unread message count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    // Get all matches for user
    const matches = await this.matchModel.find({
      $or: [{ artistUser: userId }, { venueUser: userId }],
      status: 'active',
    });

    const matchIds = matches.map((m) => m._id);

    return this.messageModel.countDocuments({
      match: { $in: matchIds },
      sender: { $ne: userId },
      isRead: false,
      isDeleted: false,
    });
  }

  /**
   * Get or create a conversation with a participant
   * 
   * NOTE: participantId can be either:
   * - An Artist profile ID (when participantType is 'artist')
   * - A Venue profile ID (when participantType is 'venue')
   * 
   * We need to look up the corresponding User ID from the profile.
   */
  async getOrCreateConversation(
    userId: string,
    userRole: string,
    participantId: string,
    participantType: 'artist' | 'venue',
  ): Promise<any> {
    this.logger.log(
      `🔄 getOrCreateConversation: userId=${userId}, userRole=${userRole}, ` +
      `participantId=${participantId}, participantType=${participantType}`,
    );

    // Look up the User ID from the profile ID
    let participantUserId: string;
    let participantProfileId: string;
    let currentUserProfileId: string | null = null;

    if (participantType === 'artist') {
      // participantId is an Artist profile ID - look up the user
      const artist = await this.artistModel.findById(participantId).exec();
      if (!artist) {
        throw new NotFoundException('Artist not found');
      }
      participantUserId = artist.userId.toString();
      participantProfileId = participantId;

      // Current user must be either a venue or also have a venue profile
      // Always try to get the current user's own profile for the match record
      if (userRole === 'venue') {
        const venue = await this.venueModel.findOne({ userId: userId }).exec();
        currentUserProfileId = venue?._id.toString() || null;
        if (!currentUserProfileId) {
          this.logger.warn(`Venue profile not found for userId=${userId}`);
          throw new BadRequestException(
            'Your venue profile is incomplete. Please complete your profile first.',
          );
        }
      } else if (userRole === 'artist') {
        // Artist-to-artist: get current user's artist profile
        const currentArtist = await this.artistModel.findOne({ userId: userId }).exec();
        currentUserProfileId = currentArtist?._id.toString() || null;
        if (!currentUserProfileId) {
          this.logger.warn(`Artist profile not found for userId=${userId}`);
          throw new BadRequestException(
            'Your artist profile is incomplete. Please complete your profile first.',
          );
        }
      }
    } else {
      // participantId is a Venue profile ID - look up the user
      const venue = await this.venueModel.findById(participantId).exec();
      if (!venue) {
        throw new NotFoundException('Venue not found');
      }
      participantUserId = venue.userId.toString();
      participantProfileId = participantId;

      // Current user must have their own profile for the match record
      if (userRole === 'artist') {
        const artist = await this.artistModel.findOne({ userId: userId }).exec();
        currentUserProfileId = artist?._id.toString() || null;
        if (!currentUserProfileId) {
          this.logger.warn(`Artist profile not found for userId=${userId}`);
          throw new BadRequestException(
            'Your artist profile is incomplete. Please complete your profile first.',
          );
        }
      } else if (userRole === 'venue') {
        // Venue-to-venue: get current user's venue profile
        const currentVenue = await this.venueModel.findOne({ userId: userId }).exec();
        currentUserProfileId = currentVenue?._id.toString() || null;
        if (!currentUserProfileId) {
          this.logger.warn(`Venue profile not found for userId=${userId}`);
          throw new BadRequestException(
            'Your venue profile is incomplete. Please complete your profile first.',
          );
        }
      }
    }

    // Check if user is trying to message themselves
    if (userId === participantUserId) {
      throw new BadRequestException('Cannot create conversation with yourself');
    }

    // Determine artist and venue user IDs for the match
    // The match schema requires artistUser + venueUser to be distinct roles.
    // If both users have the same role, we still need to map them properly.
    let artistUserId: string;
    let venueUserId: string;
    let artistProfileId: string | null;
    let venueProfileId: string | null;

    if (participantType === 'artist') {
      // Participant is an artist, current user provides the venue side
      artistUserId = participantUserId;
      artistProfileId = participantProfileId;
      venueUserId = userId;
      venueProfileId = currentUserProfileId;
    } else {
      // Participant is a venue, current user provides the artist side
      artistUserId = userId;
      artistProfileId = currentUserProfileId;
      venueUserId = participantUserId;
      venueProfileId = participantProfileId;
    }

    this.logger.log(
      `🔍 Match lookup: artistUser=${artistUserId}, venueUser=${venueUserId}, ` +
      `artistProfile=${artistProfileId}, venueProfile=${venueProfileId}`,
    );

    // Find existing match using user IDs OR profile IDs (swipe-created matches may only have profile IDs)
    // NOTE: Do NOT filter out blocked matches here — we need to detect them and handle gracefully
    let match = await this.matchModel
      .findOne({
        $or: [
          { artistUser: artistUserId, venueUser: venueUserId },
          { artistUser: venueUserId, venueUser: artistUserId },
          ...(artistProfileId && venueProfileId
            ? [
                { artist: new Types.ObjectId(artistProfileId), venue: new Types.ObjectId(venueProfileId) },
                { artist: new Types.ObjectId(venueProfileId), venue: new Types.ObjectId(artistProfileId) },
              ]
            : []),
        ],
      })
      .exec();

    this.logger.log(
      `🔍 Match lookup result: ${match ? `found match ${match._id} (status=${match.status})` : 'no match found'}`,
    );

    // If match is blocked, auto-unblock when the blocker initiates a new conversation
    if (match && match.status === 'blocked') {
      const blockerStr = match.blockedBy?.toString();
      if (blockerStr === userId) {
        this.logger.log(
          `🔓 Auto-unblocking match ${match._id} — blocker (${userId}) is initiating conversation`,
        );
        await this.matchModel.findByIdAndUpdate(match._id, {
          status: 'active',
          $unset: { blockedBy: '', blockedAt: '', blockReason: '' },
        }).exec();
        match.status = 'active';
        (match as any).blockedBy = undefined;
      } else {
        this.logger.warn(
          `🚫 Match ${match._id} is blocked by ${blockerStr}, current user ${userId} cannot message`,
        );
        throw new BadRequestException(
          'This conversation has been blocked by the other user.',
        );
      }
    }

    // Get participant details for response
    let participantName: string | undefined;
    let participantPhoto: string | undefined;

    if (participantType === 'artist') {
      const artist = await this.artistModel.findById(participantProfileId).exec();
      participantName = artist?.displayName;
      participantPhoto = artist?.profilePhotoUrl;
    } else {
      const venue = await this.venueModel.findById(participantProfileId).exec();
      participantName = venue?.venueName;
      // Venue uses photos array with isPrimary, get primary or first photo
      const primaryPhoto = venue?.photos?.find(p => p.isPrimary);
      participantPhoto = primaryPhoto?.url || venue?.photos?.[0]?.url;
    }

    // If match exists (active/archived), return conversation info
    if (match) {
      return {
        id: match._id.toString(),
        matchId: match._id.toString(),
        participantId: participantProfileId,
        participantUserId,
        participantType,
        participantName,
        participantPhoto,
        isMatch: true,
        lastMessageAt: match.lastMessageAt,
        lastMessagePreview: match.lastMessagePreview,
      };
    }

    // No match exists - create a new conversation/match
    // Final safety guard: both profile IDs must be non-null for match creation
    if (!artistProfileId || !venueProfileId) {
      this.logger.error(
        `❌ Cannot create match: artistProfileId=${artistProfileId}, venueProfileId=${venueProfileId}`,
      );
      throw new BadRequestException(
        'Cannot create conversation: missing profile information.',
      );
    }

    this.logger.log(
      `✨ Creating new match: artist=${artistProfileId}, venue=${venueProfileId}, ` +
      `artistUser=${artistUserId}, venueUser=${venueUserId}`,
    );

    try {
      const newMatch = new this.matchModel({
        artist: new Types.ObjectId(artistProfileId),
        venue: new Types.ObjectId(venueProfileId),
        artistUser: new Types.ObjectId(artistUserId),
        venueUser: new Types.ObjectId(venueUserId),
        status: 'active',
        hasMessages: false,
        unreadCount: { artist: 0, venue: 0 },
        initiatedBy: userRole as 'artist' | 'venue',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await newMatch.save();

      this.logger.log(`✅ Match created: ${newMatch._id.toString()}`);

      return {
        id: newMatch._id.toString(),
        matchId: newMatch._id.toString(),
        participantId: participantProfileId,
        participantUserId,
        participantType,
        participantName,
        participantPhoto,
        isMatch: false,
        lastMessageAt: null,
        lastMessagePreview: null,
      };
    } catch (error) {
      // Handle duplicate key error (race condition or match created by swipe system)
      if (error.code === 11000) {
        this.logger.warn(
          `⚠️ Duplicate match detected, fetching existing match: artist=${artistProfileId}, venue=${venueProfileId}`,
        );
        const existingMatch = await this.matchModel
          .findOne({
            $or: [
              { artist: new Types.ObjectId(artistProfileId!), venue: new Types.ObjectId(venueProfileId!) },
              { artistUser: artistUserId, venueUser: venueUserId },
            ],
          })
          .exec();

        if (existingMatch) {
          // If the found match is blocked, handle it
          if (existingMatch.status === 'blocked') {
            const blockerStr = existingMatch.blockedBy?.toString();
            if (blockerStr === userId) {
              this.logger.log(`🔓 Auto-unblocking match ${existingMatch._id} after duplicate error`);
              await this.matchModel.findByIdAndUpdate(existingMatch._id, {
                status: 'active',
                $unset: { blockedBy: '', blockedAt: '', blockReason: '' },
              }).exec();
            } else {
              throw new BadRequestException('This conversation has been blocked by the other user.');
            }
          }

          this.logger.log(`✅ Found existing match after duplicate error: ${existingMatch._id}`);
          return {
            id: existingMatch._id.toString(),
            matchId: existingMatch._id.toString(),
            participantId: participantProfileId,
            participantUserId,
            participantType,
            participantName,
            participantPhoto,
            isMatch: true,
            lastMessageAt: existingMatch.lastMessageAt,
            lastMessagePreview: existingMatch.lastMessagePreview,
          };
        }
      }

      this.logger.error(
        `❌ Failed to create match: ${error.message}`,
        error.stack,
      );
      if (error.name === 'ValidationError') {
        throw new BadRequestException(
          'Failed to create conversation: invalid data.',
        );
      }
      throw error;
    }
  }

  /**
   * Verify user has access to match (public wrapper)
   */
  async checkMatchAccess(matchId: string, userId: string): Promise<MatchDocument> {
    return this.verifyMatchAccess(matchId, userId);
  }

  /**
   * Verify user has access to match
   */
  private async verifyMatchAccess(matchId: string, userId: string): Promise<MatchDocument> {
    const match = await this.matchModel.findById(matchId).exec();

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (
      match.artistUser.toString() !== userId &&
      match.venueUser.toString() !== userId
    ) {
      throw new ForbiddenException('Access denied');
    }

    if (match.status === 'blocked') {
      throw new ForbiddenException('This conversation is blocked');
    }

    return match;
  }

  /**
   * Update match with last message info (message-type-aware)
   */
  private async updateMatchLastMessage(
    match: MatchDocument,
    content: string,
    senderRole: string,
    messageType?: string,
  ): Promise<void> {
    // Increment unread count for recipient
    const recipientField =
      senderRole === 'artist' ? 'unreadCount.venue' : 'unreadCount.artist';

    const preview = this.getMessagePreview(content, messageType);
    this.logger.log(
      `📝 [updateMatchLastMessage] matchId=${match._id} type=${messageType} preview="${preview}"`,
    );
    await this.matchModel.findByIdAndUpdate(match._id, {
      hasMessages: true,
      lastMessageAt: new Date(),
      lastMessagePreview: preview,
      $inc: { [recipientField]: 1 },
    });
  }

  /**
   * Block a conversation
   */
  async blockConversation(
    matchId: string,
    userId: string,
    reason?: string,
  ): Promise<void> {
    const match = await this.matchModel.findById(matchId).exec();

    if (!match) {
      throw new NotFoundException('Conversation not found');
    }

    // Verify user is part of this match
    if (
      match.artistUser.toString() !== userId &&
      match.venueUser.toString() !== userId
    ) {
      throw new ForbiddenException('Access denied');
    }

    await this.matchModel.findByIdAndUpdate(matchId, {
      status: 'blocked',
      blockedBy: userId,
      blockedAt: new Date(),
      blockReason: reason,
    });
  }

  /**
   * Unblock a conversation
   */
  async unblockConversation(matchId: string, userId: string): Promise<void> {
    const match = await this.matchModel.findById(matchId).exec();

    if (!match) {
      throw new NotFoundException('Conversation not found');
    }

    // Only the blocker can unblock
    if (match.blockedBy?.toString() !== userId) {
      throw new ForbiddenException('Only the person who blocked can unblock');
    }

    await this.matchModel.findByIdAndUpdate(matchId, {
      status: 'active',
      $unset: { blockedBy: '', blockedAt: '', blockReason: '' },
    });
  }

  /**
   * Mute a conversation
   */
  async muteConversation(
    matchId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const match = await this.verifyMatchAccess(matchId, userId);

    const muteField = userRole === 'artist' ? 'isMuted.artist' : 'isMuted.venue';
    await this.matchModel.findByIdAndUpdate(matchId, { [muteField]: true });
  }

  /**
   * Unmute a conversation
   */
  async unmuteConversation(
    matchId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const match = await this.verifyMatchAccess(matchId, userId);

    const muteField = userRole === 'artist' ? 'isMuted.artist' : 'isMuted.venue';
    await this.matchModel.findByIdAndUpdate(matchId, { [muteField]: false });
  }

  /**
   * Check if conversation is muted for user
   */
  async isConversationMuted(
    matchId: string,
    userId: string,
    userRole: string,
  ): Promise<boolean> {
    const match = await this.matchModel.findById(matchId).exec();
    if (!match) {
      return false;
    }

    return userRole === 'artist' 
      ? match.isMuted?.artist ?? false 
      : match.isMuted?.venue ?? false;
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(matchId: string, userId: string): Promise<void> {
    const match = await this.verifyMatchAccess(matchId, userId);
    await this.matchModel.findByIdAndUpdate(matchId, { status: 'archived' });
  }

  /**
   * Unarchive a conversation
   */
  async unarchiveConversation(matchId: string, userId: string): Promise<void> {
    const match = await this.verifyMatchAccess(matchId, userId);
    await this.matchModel.findByIdAndUpdate(matchId, { status: 'active' });
  }

  /**
   * Pin a conversation (stored per-user in metadata)
   */
  async pinConversation(
    matchId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const match = await this.verifyMatchAccess(matchId, userId);
    const pinField = userRole === 'artist' ? 'isPinned.artist' : 'isPinned.venue';
    await this.matchModel.findByIdAndUpdate(matchId, { [pinField]: true });
  }

  /**
   * Unpin a conversation
   */
  async unpinConversation(
    matchId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const match = await this.verifyMatchAccess(matchId, userId);
    const pinField = userRole === 'artist' ? 'isPinned.artist' : 'isPinned.venue';
    await this.matchModel.findByIdAndUpdate(matchId, { [pinField]: false });
  }
}
