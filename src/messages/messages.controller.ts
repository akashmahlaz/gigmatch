import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { SendMessageDto, GetMessagesDto, MarkMessagesReadDto, MarkMultipleMessagesReadDto } from './dto/message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../schemas/user.schema';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload media file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  async uploadMedia(
    @CurrentUser() user: UserPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type
    const allowedTypes = ['image/', 'audio/', 'application/pdf'];
    const isValidType = allowedTypes.some(type => file.mimetype.startsWith(type));

    if (!isValidType) {
      throw new BadRequestException('Invalid file type. Allowed: images, audio, PDF');
    }

    // Upload to storage (implementation depends on your storage provider)
    const url = await this.messagesService.uploadMedia(file);

    return {
      url,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  /**
   * Get or create a conversation with a participant
   */
  @Post('conversations/get-or-create')
  @ApiOperation({ summary: 'Get or create a conversation with a participant' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        participantId: { type: 'string' },
        participantType: { type: 'string', enum: ['artist', 'venue'] },
      },
      required: ['participantId', 'participantType'],
    },
  })
  @ApiResponse({ status: 200, description: 'Conversation retrieved or created' })
  @ApiResponse({ status: 400, description: 'Invalid participant' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getOrCreateConversation(
    @CurrentUser() user: UserPayload,
    @Body() body: { participantId: string; participantType: 'artist' | 'venue' },
  ) {
    return this.messagesService.getOrCreateConversation(
      user._id.toString(),
      user.role,
      body.participantId,
      body.participantType,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Send a message' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async sendMessage(
    @CurrentUser() user: UserPayload,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    const message = await this.messagesService.sendMessage(
      user._id.toString(),
      user.role,
      sendMessageDto,
    );

    // Broadcast via WebSocket so the receiver gets it in real-time
    this.logger.log(
      `📨 [REST sendMessage] user=${user.email} matchId=${sendMessageDto.matchId} ` +
      `type=${sendMessageDto.messageType || 'text'}`,
    );
    this.messagesGateway.server
      .to(`match:${sendMessageDto.matchId}`)
      .emit('new_message', {
        message,
        sender: {
          id: user._id.toString(),
          name: user.fullName ?? user.email,
        },
      });

    return message;
  }

  @Get()
  @ApiOperation({ summary: 'Get messages for a match' })
  @ApiResponse({ status: 200, description: 'Messages retrieved' })
  async getMessages(
    @CurrentUser() user: UserPayload,
    @Query() queryDto: GetMessagesDto,
  ) {
    return this.messagesService.getMessages(user._id.toString(), queryDto);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get total unread message count' })
  @ApiResponse({ status: 200, description: 'Count returned' })
  async getUnreadCount(@CurrentUser() user: UserPayload) {
    const count = await this.messagesService.getUnreadCount(user._id.toString());
    return { unreadCount: count };
  }

  @Post('read')
  @ApiOperation({ summary: 'Mark messages as read' })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async markAsRead(
    @CurrentUser() user: UserPayload,
    @Body() markReadDto: MarkMessagesReadDto,
  ) {
    await this.messagesService.markAsRead(
      user._id.toString(),
      user.role,
      markReadDto,
    );

    // Broadcast read receipt via WebSocket
    this.logger.log(
      `✅ [REST markAsRead] user=${user.email} matchId=${markReadDto.matchId}`,
    );
    this.messagesGateway.server
      .to(`match:${markReadDto.matchId}`)
      .emit('messages_read', {
        matchId: markReadDto.matchId,
        readBy: user._id.toString(),
      });

    return { message: 'Messages marked as read' };
  }

  @Post('read/bulk')
  @ApiOperation({ summary: 'Mark multiple specific messages as read' })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async markMultipleAsRead(
    @CurrentUser() user: UserPayload,
    @Body() dto: MarkMultipleMessagesReadDto,
  ) {
    // Verify access if matchId is provided
    if (dto.matchId) {
      await this.messagesService.checkMatchAccess(dto.matchId, user._id.toString());
    }

    // Mark each message as read
    const matchIdsRead = new Set<string>();
    for (const messageId of dto.messageIds) {
      try {
        const message = await this.messagesService.getMessageById(messageId);
        if (message && message.sender.toString() !== user._id.toString()) {
          const matchId = message.match.toString();
          await this.messagesService.markAsRead(
            user._id.toString(),
            user.role,
            { matchId, messageIds: [messageId] },
          );
          matchIdsRead.add(matchId);
        }
      } catch (err) {
        // Skip individual errors
        this.logger.warn(`Failed to mark message ${messageId} as read`);
      }
    }

    // Broadcast read receipts for each affected match room
    for (const matchId of matchIdsRead) {
      this.messagesGateway.server
        .to(`match:${matchId}`)
        .emit('messages_read', {
          matchId,
          readBy: user._id.toString(),
        });
    }

    return { message: 'Messages marked as read' };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search messages' })
  @ApiQuery({ name: 'query', required: true })
  @ApiQuery({ name: 'matchId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Search results returned' })
  async searchMessages(
    @CurrentUser() user: UserPayload,
    @Query('query') query: string,
    @Query('matchId') matchId?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.messagesService.searchMessages(
      user._id.toString(),
      query,
      matchId,
      page,
      limit,
    );
  }

  @Post('conversations/:matchId/block')
  @ApiOperation({ summary: 'Block a conversation' })
  @ApiParam({ name: 'matchId', description: 'Match/Conversation ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Optional reason for blocking' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Conversation blocked' })
  async blockConversation(
    @CurrentUser() user: UserPayload,
    @Param('matchId') matchId: string,
    @Body() body: { reason?: string },
  ) {
    await this.messagesService.blockConversation(
      matchId,
      user._id.toString(),
      body.reason,
    );
    return { message: 'Conversation blocked' };
  }

  @Post('conversations/:matchId/unblock')
  @ApiOperation({ summary: 'Unblock a conversation' })
  @ApiParam({ name: 'matchId', description: 'Match/Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation unblocked' })
  async unblockConversation(
    @CurrentUser() user: UserPayload,
    @Param('matchId') matchId: string,
  ) {
    await this.messagesService.unblockConversation(matchId, user._id.toString());
    return { message: 'Conversation unblocked' };
  }

  @Post('conversations/:matchId/mute')
  @ApiOperation({ summary: 'Mute a conversation' })
  @ApiParam({ name: 'matchId', description: 'Match/Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation muted' })
  async muteConversation(
    @CurrentUser() user: UserPayload,
    @Param('matchId') matchId: string,
  ) {
    await this.messagesService.muteConversation(
      matchId,
      user._id.toString(),
      user.role,
    );
    return { message: 'Conversation muted' };
  }

  @Post('conversations/:matchId/unmute')
  @ApiOperation({ summary: 'Unmute a conversation' })
  @ApiParam({ name: 'matchId', description: 'Match/Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation unmuted' })
  async unmuteConversation(
    @CurrentUser() user: UserPayload,
    @Param('matchId') matchId: string,
  ) {
    await this.messagesService.unmuteConversation(
      matchId,
      user._id.toString(),
      user.role,
    );
    return { message: 'Conversation unmuted' };
  }

  @Post('conversations/:matchId/archive')
  @ApiOperation({ summary: 'Archive a conversation' })
  @ApiParam({ name: 'matchId', description: 'Match/Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation archived' })
  async archiveConversation(
    @CurrentUser() user: UserPayload,
    @Param('matchId') matchId: string,
  ) {
    await this.messagesService.archiveConversation(matchId, user._id.toString());
    return { message: 'Conversation archived' };
  }

  @Post('conversations/:matchId/unarchive')
  @ApiOperation({ summary: 'Unarchive a conversation' })
  @ApiParam({ name: 'matchId', description: 'Match/Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation unarchived' })
  async unarchiveConversation(
    @CurrentUser() user: UserPayload,
    @Param('matchId') matchId: string,
  ) {
    await this.messagesService.unarchiveConversation(matchId, user._id.toString());
    return { message: 'Conversation unarchived' };
  }

  @Post('conversations/:matchId/pin')
  @ApiOperation({ summary: 'Pin a conversation' })
  @ApiParam({ name: 'matchId', description: 'Match/Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation pinned' })
  async pinConversation(
    @CurrentUser() user: UserPayload,
    @Param('matchId') matchId: string,
  ) {
    await this.messagesService.pinConversation(
      matchId,
      user._id.toString(),
      user.role,
    );
    return { message: 'Conversation pinned' };
  }

  @Post('conversations/:matchId/unpin')
  @ApiOperation({ summary: 'Unpin a conversation' })
  @ApiParam({ name: 'matchId', description: 'Match/Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation unpinned' })
  async unpinConversation(
    @CurrentUser() user: UserPayload,
    @Param('matchId') matchId: string,
  ) {
    await this.messagesService.unpinConversation(
      matchId,
      user._id.toString(),
      user.role,
    );
    return { message: 'Conversation unpinned' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a message' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message deleted' })
  @ApiResponse({ status: 403, description: 'Cannot delete this message' })
  async deleteMessage(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
  ) {
    await this.messagesService.deleteMessage(id, user._id.toString());
    return { message: 'Message deleted' };
  }
}
