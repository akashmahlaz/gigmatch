import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Match, MatchDocument } from '../schemas/match.schema';
import { MessagesService } from './messages.service';
import { WsJoinRoomDto, WsTypingDto, WsMessageDto } from './dto/message.dto';

interface AuthenticatedSocket extends Socket {
  user: UserDocument;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('MessagesGateway');
  private connectedUsers = new Map<string, string[]>(); // userId -> socketIds

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private messagesService: MessagesService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
  ) {}

  /**
   * Handle new connection
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn('No token provided');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.userModel.findById(payload.sub).exec();

      if (!user) {
        this.logger.warn('User not found');
        client.disconnect();
        return;
      }

      client.user = user;

      // Track connected socket
      const userId = user._id.toString();
      const userSockets = this.connectedUsers.get(userId) || [];
      userSockets.push(client.id);
      this.connectedUsers.set(userId, userSockets);

      this.logger.log(`User ${user.email} connected (${client.id})`);

      // Auto-join all active match rooms
      const matches = await this.matchModel
        .find({
          $or: [{ artistUser: userId }, { venueUser: userId }],
          status: 'active',
        })
        .exec();

      for (const match of matches) {
        client.join(`match:${match._id}`);
      }

      client.emit('connected', { userId, socketId: client.id });
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  /**
   * Handle disconnect
   */
  handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      const userId = client.user._id.toString();
      const userSockets = this.connectedUsers.get(userId) || [];
      const filteredSockets = userSockets.filter((id) => id !== client.id);

      if (filteredSockets.length > 0) {
        this.connectedUsers.set(userId, filteredSockets);
      } else {
        this.connectedUsers.delete(userId);
      }

      this.logger.log(`User ${client.user.email} disconnected (${client.id})`);
    }
  }

  /**
   * Join a match room
   */
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: WsJoinRoomDto,
  ) {
    const { matchId } = data;
    const userId = client.user._id.toString();

    // Verify access
    const match = await this.matchModel.findById(matchId).exec();
    if (
      !match ||
      (match.artistUser.toString() !== userId && match.venueUser.toString() !== userId)
    ) {
      client.emit('error', { message: 'Access denied' });
      return;
    }

    client.join(`match:${matchId}`);
    client.emit('joined_room', { matchId });
    this.logger.log(`User ${client.user.email} joined room match:${matchId}`);
  }

  /**
   * Leave a match room
   */
  @SubscribeMessage('leave_room')
  handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { matchId: string },
  ) {
    client.leave(`match:${data.matchId}`);
    client.emit('left_room', { matchId: data.matchId });
  }

  /**
   * Handle typing indicator
   */
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: WsTypingDto,
  ) {
    const { matchId, isTyping } = data;
    const userId = client.user._id.toString();

    // Broadcast to other users in the room
    client.to(`match:${matchId}`).emit('user_typing', {
      matchId,
      userId,
      userName: client.user.fullName,
      isTyping,
    });
  }

  /**
   * Handle new message via WebSocket
   */
  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: WsMessageDto,
  ) {
    try {
      const userId = client.user._id.toString();
      const userRole = client.user.role;

      const message = await this.messagesService.sendMessage(userId, userRole, {
        matchId: data.matchId,
        content: data.content,
        messageType: data.messageType as any,
        attachments: data.attachments,
      });

      // Broadcast to all users in the room
      this.server.to(`match:${data.matchId}`).emit('new_message', {
        message,
        sender: {
          id: userId,
          name: client.user.fullName,
        },
      });

      // Send notification to offline users
      const match = await this.matchModel.findById(data.matchId).exec();
      if (match) {
        const recipientId =
          match.artistUser.toString() === userId
            ? match.venueUser.toString()
            : match.artistUser.toString();

        if (!this.isUserOnline(recipientId)) {
          // TODO: Send push notification
          this.logger.log(`User ${recipientId} is offline, should send push notification`);
        }
      }
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Mark messages as read via WebSocket
   */
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { matchId: string },
  ) {
    try {
      await this.messagesService.markAsRead(
        client.user._id.toString(),
        client.user.role,
        { matchId: data.matchId },
      );

      // Notify sender that messages were read
      client.to(`match:${data.matchId}`).emit('messages_read', {
        matchId: data.matchId,
        readBy: client.user._id.toString(),
      });
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Check if user is online
   */
  private isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, event: string, data: any) {
    const socketIds = this.connectedUsers.get(userId);
    if (socketIds) {
      for (const socketId of socketIds) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }
}
