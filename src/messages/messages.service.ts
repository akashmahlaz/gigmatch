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
import { SendMessageDto, GetMessagesDto, MarkMessagesReadDto } from './dto/message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
  ) {}

  /**
   * Send a message in a match conversation
   */
  async sendMessage(
    userId: string,
    userRole: string,
    sendMessageDto: SendMessageDto,
  ): Promise<MessageDocument> {
    const { matchId, messageType = 'text', content, attachments, replyTo } = sendMessageDto;

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
      replyTo,
      deliveryStatus: 'sent',
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
