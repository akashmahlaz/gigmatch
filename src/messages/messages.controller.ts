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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessagesService } from './messages.service';
import { SendMessageDto, GetMessagesDto, MarkMessagesReadDto } from './dto/message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../schemas/user.schema';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

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
    return this.messagesService.sendMessage(
      user._id.toString(),
      user.role,
      sendMessageDto,
    );
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
    return { message: 'Messages marked as read' };
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
