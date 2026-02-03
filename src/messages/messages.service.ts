import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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

    // Update match with last message info
    await this.updateMatchLastMessage(match, content || 'Sent an attachment', userRole);

    return message;
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

      // If current user is a venue, get their venue profile ID
      if (userRole === 'venue') {
        const venue = await this.venueModel.findOne({ userId: userId }).exec();
        currentUserProfileId = venue?._id.toString() || null;
      }
    } else {
      // participantId is a Venue profile ID - look up the user
      const venue = await this.venueModel.findById(participantId).exec();
      if (!venue) {
        throw new NotFoundException('Venue not found');
      }
      participantUserId = venue.userId.toString();
      participantProfileId = participantId;

      // If current user is an artist, get their artist profile ID
      if (userRole === 'artist') {
        const artist = await this.artistModel.findOne({ userId: userId }).exec();
        currentUserProfileId = artist?._id.toString() || null;
      }
    }

    // Check if user is trying to message themselves
    if (userId === participantUserId) {
      throw new BadRequestException('Cannot create conversation with yourself');
    }

    // Determine artist and venue IDs for the match
    const artistUserId = participantType === 'artist' ? participantUserId : userId;
    const venueUserId = participantType === 'venue' ? participantUserId : userId;
    const artistProfileId = participantType === 'artist' ? participantProfileId : currentUserProfileId;
    const venueProfileId = participantType === 'venue' ? participantProfileId : currentUserProfileId;

    // Find existing match using user IDs
    let match = await this.matchModel
      .findOne({
        artistUser: artistUserId,
        venueUser: venueUserId,
        status: { $ne: 'blocked' },
      })
      .exec();

    // If match exists, return conversation info
    if (match) {
      return {
        id: match._id.toString(),
        matchId: match._id.toString(),
        participantId: participantProfileId,
        participantUserId,
        participantType,
        isMatch: true,
        lastMessageAt: match.lastMessageAt,
        lastMessagePreview: match.lastMessagePreview,
      };
    }

    // No match exists - create a new conversation/match
    const newMatch = new this.matchModel({
      artist: artistProfileId ? new Types.ObjectId(artistProfileId) : undefined,
      venue: venueProfileId ? new Types.ObjectId(venueProfileId) : undefined,
      artistUser: artistUserId,
      venueUser: venueUserId,
      status: 'active',
      hasMessages: false,
      unreadCount: { artist: 0, venue: 0 },
      initiatedBy: userRole as 'artist' | 'venue',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newMatch.save();

    return {
      id: newMatch._id.toString(),
      matchId: newMatch._id.toString(),
      participantId: participantProfileId,
      participantUserId,
      participantType,
      isMatch: false,
      lastMessageAt: null,
      lastMessagePreview: null,
    };
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
   * Update match with last message info
   */
  private async updateMatchLastMessage(
    match: MatchDocument,
    content: string,
    senderRole: string,
  ): Promise<void> {
    // Increment unread count for recipient
    const recipientField =
      senderRole === 'artist' ? 'unreadCount.venue' : 'unreadCount.artist';

    await this.matchModel.findByIdAndUpdate(match._id, {
      hasMessages: true,
      lastMessageAt: new Date(),
      lastMessagePreview:
        content.length > 50 ? content.substring(0, 50) + '...' : content,
      $inc: { [recipientField]: 1 },
    });
  }
}
