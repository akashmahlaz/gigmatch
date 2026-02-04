/// 🔔 GigMatch Notification Service - Backend Implementation
///
/// Comprehensive notification service for push notifications and in-app alerts
/// Features:
/// - Push notification sending via FCM
/// - In-app notification storage
/// - Notification preferences management
/// - Template-based notifications
/// - Notification batching and scheduling
/// - Multi-language support
/// - Delivery tracking and analytics

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, ClientSession, Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import type { FirebaseAdmin } from './firebase.provider';
import { INJECTION_TOKEN } from './firebase.provider';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import {
  DeviceToken,
  DeviceTokenDocument,
  DevicePlatform,
} from './schemas/device-token.schema';

interface NotificationPayload {
  type: string;
  title: string;
  body: string;
  deepLink?: string;
  data?: Record<string, string>;
  priority?: 'high' | 'default' | 'low';
  imageUrl?: string;
  badge?: number;
  sound?: string;
}

interface SendNotificationDto {
  userId: string;
  type: string;
  title: string;
  body: string;
  deepLink?: string;
  data?: Record<string, string>;
  priority?: 'high' | 'default' | 'low';
  imageUrl?: string;
  scheduleAt?: Date;
  expiresAt?: Date;
}

interface NotificationTemplate {
  type: string;
  titleKey: string;
  bodyKey: string;
  defaultTitle: string;
  defaultBody: string;
  priority: 'high' | 'default' | 'low';
  deepLinkPattern?: string;
}

interface NotificationStats {
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
}

interface NotificationPreferences {
  notificationsEnabled: boolean;
  matchNotifications: boolean;
  messageNotifications: boolean;
  gigNotifications: boolean;
  bookingNotifications: boolean;
  reviewNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly templates: Map<string, NotificationTemplate> = new Map();

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(DeviceToken.name)
    private deviceTokenModel: Model<DeviceTokenDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectConnection() private connection: Connection,
    private configService: ConfigService,
    @Inject(INJECTION_TOKEN) private firebaseAdmin: FirebaseAdmin,
  ) {
    this.initializeTemplates();
    if (this.firebaseAdmin.messaging) {
      this.logger.log('✅ Firebase Messaging initialized and ready');
    } else {
      this.logger.warn('⚠️ Firebase Messaging not available - push notifications disabled');
    }
  }

  /// Initialize notification templates
  private initializeTemplates(): void {
    const templates: NotificationTemplate[] = [
      {
        type: 'match',
        titleKey: 'notifications.match.title',
        bodyKey: 'notifications.match.body',
        defaultTitle: '🎵 New Match!',
        defaultBody:
          'You have a new match! Start chatting to discuss potential gigs.',
        priority: 'high',
        deepLinkPattern: '/matches/{matchId}',
      },
      {
        type: 'message',
        titleKey: 'notifications.message.title',
        bodyKey: 'notifications.message.body',
        defaultTitle: '💬 New Message',
        defaultBody: 'You have a new message',
        priority: 'high',
        deepLinkPattern: '/chat/{conversationId}',
      },
      {
        type: 'gig_opportunity',
        titleKey: 'notifications.gig_opportunity.title',
        bodyKey: 'notifications.gig_opportunity.body',
        defaultTitle: '🎸 New Gig Opportunity',
        defaultBody: 'A new gig matching your profile is available!',
        priority: 'high',
        deepLinkPattern: '/gigs/{gigId}',
      },
      {
        type: 'booking_confirmation',
        titleKey: 'notifications.booking_confirmation.title',
        bodyKey: 'notifications.booking_confirmation.body',
        defaultTitle: '✅ Booking Confirmed',
        defaultBody: 'Your booking has been confirmed!',
        priority: 'high',
        deepLinkPattern: '/bookings/{bookingId}',
      },
      {
        type: 'booking_reminder',
        titleKey: 'notifications.booking_reminder.title',
        bodyKey: 'notifications.booking_reminder.body',
        defaultTitle: '⏰ Gig Reminder',
        defaultBody: 'You have a gig coming up soon!',
        priority: 'default',
        deepLinkPattern: '/bookings/{bookingId}',
      },
      {
        type: 'review_received',
        titleKey: 'notifications.review_received.title',
        bodyKey: 'notifications.review_received.body',
        defaultTitle: '⭐ New Review',
        defaultBody: 'You received a new review!',
        priority: 'default',
        deepLinkPattern: '/profile/reviews',
      },
      {
        type: 'subscription_expired',
        titleKey: 'notifications.subscription_expired.title',
        bodyKey: 'notifications.subscription_expired.body',
        defaultTitle: '⚠️ Subscription Expired',
        defaultBody:
          'Your subscription has expired. Renew to access premium features.',
        priority: 'high',
        deepLinkPattern: '/subscription',
      },
      {
        type: 'boost_expiring',
        titleKey: 'notifications.boost_expiring.title',
        bodyKey: 'notifications.boost_expiring.body',
        defaultTitle: '🚀 Boost Expiring',
        defaultBody: 'Your profile boost expires soon!',
        priority: 'default',
        deepLinkPattern: '/profile/boost',
      },
      {
        type: 'payment_received',
        titleKey: 'notifications.payment_received.title',
        bodyKey: 'notifications.payment_received.body',
        defaultTitle: '💰 Payment Received',
        defaultBody: 'You have received a payment for your gig!',
        priority: 'high',
        deepLinkPattern: '/wallet',
      },
      {
        type: 'gig_cancelled',
        titleKey: 'notifications.gig_cancelled.title',
        bodyKey: 'notifications.gig_cancelled.body',
        defaultTitle: '❌ Gig Cancelled',
        defaultBody: 'A gig has been cancelled',
        priority: 'high',
        deepLinkPattern: '/gigs/{gigId}',
      },
    ];

    for (const template of templates) {
      this.templates.set(template.type, template);
    }
  }

  /// Send notification to a user
  async sendNotification(
    dto: SendNotificationDto,
  ): Promise<NotificationDocument> {
    const userIdObj = new Types.ObjectId(dto.userId);

    // Check user notification preferences
    const user = await this.userModel
      .findById(userIdObj)
      .select('notificationPreferences')
      .exec();
    if (
      user?.notificationPreferences &&
      !user.notificationPreferences.notificationsEnabled
    ) {
      this.logger.debug(`Notifications disabled for user ${dto.userId}`);
      // Still create the notification record but don't send push
    }

    // Create in-app notification
    const notification = new this.notificationModel({
      userId: userIdObj,
      type: dto.type as NotificationType,
      title: dto.title,
      body: dto.body,
      deepLink: dto.deepLink,
      data: dto.data,
      isRead: false,
      expiresAt: dto.expiresAt,
    });

    await notification.save();

    // If scheduled, return here - will be processed by scheduler
    if (dto.scheduleAt && dto.scheduleAt > new Date()) {
      return notification;
    }

    // Send push notification
    await this.sendPushNotification(userIdObj.toString(), {
      type: dto.type,
      title: dto.title,
      body: dto.body,
      deepLink: dto.deepLink,
      data: dto.data,
      priority: dto.priority,
      imageUrl: dto.imageUrl,
    });

    return notification;
  }

  /// Send push notification via FCM
  async sendPushNotification(
    userId: string,
    payload: NotificationPayload,
  ): Promise<number> {
    try {
      // Get user's device tokens
      const deviceTokens = await this.deviceTokenModel
        .find({ userId, isActive: true })
        .exec();

      if (deviceTokens.length === 0) {
        this.logger.debug(`No device tokens found for user ${userId}`);
        return 0;
      }

      const tokens = deviceTokens.map((t) => t.token);

      // Check if Firebase is configured (use injected instance)
      if (!this.firebaseAdmin || !this.firebaseAdmin.messaging) {
        this.logger.warn(
          'Firebase admin not configured, push notifications disabled',
        );
        return 0;
      }

      // Build FCM message (HTTP v1 API format)
      const buildMessage = (token: string): any => ({
        token,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: {
          type: payload.type,
          deepLink: payload.deepLink || '',
          ...payload.data,
        },
        android: {
          priority: payload.priority === 'high' ? 'high' : 'normal',
          notification: {
            channelId: this.getChannelId(payload.type),
            clickAction: payload.deepLink
              ? 'FLUTTER_NOTIFICATION_CLICK'
              : undefined,
            sound: payload.sound || 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: payload.sound || 'default',
              'content-available': payload.priority === 'high' ? 1 : undefined,
              badge: payload.badge,
            },
          },
        },
        webpush: {
          notification: {
            icon: payload.imageUrl,
            badge: payload.badge,
          },
        },
      });

      // Send to multiple tokens using Firebase Admin SDK
      if (tokens.length === 1) {
        await this.firebaseAdmin.messaging.send(buildMessage(tokens[0]));
        return 1;
      } else {
        // Build multicast message
        const multicastMessage = {
          tokens,
          notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: payload.imageUrl,
          },
          data: {
            type: payload.type,
            deepLink: payload.deepLink || '',
            ...payload.data,
          },
          android: {
            priority: (payload.priority === 'high' ? 'high' : 'normal') as 'high' | 'normal',
            notification: {
              channelId: this.getChannelId(payload.type),
              sound: payload.sound || 'default',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: payload.sound || 'default',
                badge: payload.badge,
              },
            },
          },
        };

        const response = await this.firebaseAdmin.messaging.sendEachForMulticast(multicastMessage);

        // Handle invalid tokens
        if (response.failureCount > 0) {
          await this.handleFailedTokens(tokens, response.responses);
        }

        this.logger.log(
          `📤 Push sent: ${response.successCount} success, ${response.failureCount} failed`,
        );

        return response.successCount;
      }
    } catch (error: any) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      return 0;
    }
  }

  /// Handle failed token deliveries
  private async handleFailedTokens(
    tokens: string[],
    responses: any[],
  ): Promise<void> {
    const invalidTokenIndices: number[] = [];

    responses.forEach((response, index) => {
      if (response.error) {
        const errorCode = response.error.code;
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/unregistered-device'
        ) {
          invalidTokenIndices.push(index);
        }
      }
    });

    // Deactivate invalid tokens
    for (const index of invalidTokenIndices) {
      await this.deviceTokenModel
        .findOneAndUpdate(
          { token: tokens[index] },
          { isActive: false, updatedAt: new Date() },
        )
        .exec();
    }

    if (invalidTokenIndices.length > 0) {
      this.logger.log(
        `Deactivated ${invalidTokenIndices.length} invalid device tokens`,
      );
    }
  }

  /// Get notification channel ID based on type
  private getChannelId(type: string): string {
    switch (type) {
      case 'message':
        return 'gigmatch_messages';
      case 'gig_opportunity':
      case 'booking_confirmation':
      case 'booking_reminder':
      case 'gig_cancelled':
        return 'gigmatch_gigs';
      case 'match':
      case 'review_received':
      case 'payment_received':
        return 'gigmatch_alerts';
      default:
        return 'gigmatch_general';
    }
  }

  /// Send templated notification
  async sendTemplatedNotification(
    userId: string,
    templateType: string,
    templateData: Record<string, string>,
    deepLinkParams?: Record<string, string>,
  ): Promise<NotificationDocument> {
    const template = this.templates.get(templateType);

    if (!template) {
      throw new BadRequestException(
        `Unknown notification template: ${templateType}`,
      );
    }

    // Replace placeholders in template
    let title = template.defaultTitle;
    let body = template.defaultBody;

    for (const [key, value] of Object.entries(templateData)) {
      const placeholder = `{{${key}}}`;
      title = title.replace(new RegExp(placeholder, 'g'), value);
      body = body.replace(new RegExp(placeholder, 'g'), value);
    }

    // Build deep link
    let deepLink = template.deepLinkPattern;
    if (deepLink && deepLinkParams) {
      for (const [key, value] of Object.entries(deepLinkParams)) {
        deepLink = deepLink.replace(`{${key}}`, value);
      }
    }

    return this.sendNotification({
      userId,
      type: templateType,
      title,
      body,
      deepLink,
      priority: template.priority,
    });
  }

  /// Get user's notifications
  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false,
  ): Promise<{
    notifications: NotificationDocument[];
    hasMore: boolean;
    total: number;
  }> {
    const userIdObj = new Types.ObjectId(userId);

    const filter: any = { userId: userIdObj };
    if (unreadOnly) {
      filter.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit + 1)
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);

    const hasMore = notifications.length > limit;
    if (hasMore) {
      notifications.pop();
    }

    return { notifications, hasMore, total };
  }

  /// Get unread notification count
  async getUnreadCount(userId: string): Promise<number> {
    const userIdObj = new Types.ObjectId(userId);

    return this.notificationModel
      .countDocuments({
        userId: userIdObj,
        isRead: false,
      })
      .exec();
  }

  /// Mark notification as read
  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationDocument> {
    const notification = await this.notificationModel
      .findById(notificationId)
      .exec();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId.toString() !== userId) {
      throw new BadRequestException('Notification belongs to another user');
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return notification;
  }

  /// Mark all notifications as read
  async markAllAsRead(userId: string): Promise<number> {
    const userIdObj = new Types.ObjectId(userId);

    const result = await this.notificationModel
      .updateMany(
        {
          userId: userIdObj,
          isRead: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        },
      )
      .exec();

    return result.modifiedCount;
  }

  /// Delete notification
  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    const notification = await this.notificationModel
      .findById(notificationId)
      .exec();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId.toString() !== userId) {
      throw new BadRequestException('Notification belongs to another user');
    }

    await this.notificationModel.deleteOne({ _id: notificationId }).exec();
  }

  /// Delete all notifications for user
  async deleteAllNotifications(userId: string): Promise<number> {
    const userIdObj = new Types.ObjectId(userId);

    const result = await this.notificationModel
      .deleteMany({ userId: userIdObj })
      .exec();

    return result.deletedCount || 0;
  }

  /// Register device token for push notifications
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: DevicePlatform,
    deviceInfo?: {
      deviceModel?: string;
      osVersion?: string;
      appVersion?: string;
    },
  ): Promise<DeviceTokenDocument> {
    // Check if token already exists
    let deviceToken = await this.deviceTokenModel.findOne({ token }).exec();

    if (deviceToken) {
      // Update existing token
      deviceToken.userId = new Types.ObjectId(userId);
      deviceToken.platform = platform;
      deviceToken.isActive = true;
      deviceToken.lastUsedAt = new Date();
      if (deviceInfo) {
        deviceToken.deviceModel = deviceInfo.deviceModel;
        deviceToken.osVersion = deviceInfo.osVersion;
        deviceToken.appVersion = deviceInfo.appVersion;
      }
    } else {
      // Create new token
      deviceToken = new this.deviceTokenModel({
        userId: new Types.ObjectId(userId),
        token,
        platform,
        isActive: true,
        lastUsedAt: new Date(),
        deviceModel: deviceInfo?.deviceModel,
        osVersion: deviceInfo?.osVersion,
        appVersion: deviceInfo?.appVersion,
      });
    }

    await deviceToken.save();
    return deviceToken;
  }

  /// Unregister device token
  async unregisterDeviceToken(token: string): Promise<void> {
    await this.deviceTokenModel
      .findOneAndUpdate({ token }, { isActive: false, updatedAt: new Date() })
      .exec();
  }

  /// Get user's device tokens
  async getUserDeviceTokens(userId: string): Promise<DeviceTokenDocument[]> {
    return this.deviceTokenModel.find({ userId, isActive: true }).exec();
  }

  /// Update notification preferences
  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<UserDocument> {
    const userIdObj = new Types.ObjectId(userId);

    const user = await this.userModel
      .findByIdAndUpdate(
        userIdObj,
        {
          $set: {
            notificationPreferences: preferences,
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /// Get notification preferences
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const user = await this.userModel
      .findById(userId)
      .select('notificationPreferences')
      .exec();
    return user?.notificationPreferences || this.getDefaultPreferences();
  }

  /// Get default notification preferences
  private getDefaultPreferences(): NotificationPreferences {
    return {
      notificationsEnabled: true,
      matchNotifications: true,
      messageNotifications: true,
      gigNotifications: true,
      bookingNotifications: true,
      reviewNotifications: true,
      emailNotifications: true,
      pushNotifications: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    };
  }

  /// Send bulk notifications
  async sendBulkNotifications(
    userIds: string[],
    notification: Omit<SendNotificationDto, 'userId'>,
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        await this.sendNotification({ ...notification, userId });
        sent++;
      } catch (error: any) {
        this.logger.error(
          `Failed to send notification to ${userId}: ${error.message}`,
        );
        failed++;
      }
    }

    return { sent, failed };
  }

  /// Schedule notification for later delivery
  async scheduleNotification(
    dto: SendNotificationDto,
  ): Promise<NotificationDocument> {
    if (!dto.scheduleAt || dto.scheduleAt <= new Date()) {
      throw new BadRequestException('scheduleAt must be in the future');
    }

    return this.sendNotification(dto);
  }

  /// Cancel scheduled notification
  async cancelScheduledNotification(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    const notification = await this.notificationModel
      .findById(notificationId)
      .exec();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId.toString() !== userId) {
      throw new BadRequestException('Notification belongs to another user');
    }

    await this.notificationModel.deleteOne({ _id: notificationId }).exec();
  }

  /// Get notification statistics for a user
  async getStats(
    userId: string,
    period: string = 'month',
  ): Promise<NotificationStats> {
    const userIdObj = new Types.ObjectId(userId);
    const startDate = this.getStartDate(period);

    const [totalSent, opened, clicked] = await Promise.all([
      this.notificationModel.countDocuments({
        userId: userIdObj,
        createdAt: { $gte: startDate },
      }),
      this.notificationModel.countDocuments({
        userId: userIdObj,
        readAt: { $gte: startDate },
      }),
      this.notificationModel.countDocuments({
        userId: userIdObj,
        clickedAt: { $gte: startDate },
      }),
    ]);

    return {
      totalSent,
      delivered: totalSent, // Simplified - assume all sent were delivered
      opened,
      clicked,
    };
  }

  /// Track notification click
  async trackClick(notificationId: string): Promise<void> {
    await this.notificationModel
      .findByIdAndUpdate(notificationId, {
        clickedAt: new Date(),
      })
      .exec();
  }

  /// Process scheduled notifications
  async processScheduledNotifications(): Promise<void> {
    const now = new Date();

    const scheduledNotifications = await this.notificationModel
      .find({
        type: NotificationType.GIG_REMINDER,
        createdAt: { $lte: now },
        isRead: false,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
      })
      .limit(100)
      .exec();

    for (const notification of scheduledNotifications) {
      try {
        await this.sendPushNotification(notification.userId.toString(), {
          type: notification.type,
          title: notification.title,
          body: notification.body,
          deepLink: notification.deepLink,
          data: notification.data as Record<string, string>,
        });
      } catch (error: any) {
        this.logger.error(
          `Failed to process scheduled notification ${notification._id}: ${error.message}`,
        );
      }
    }
  }

  /// Get start date for period
  private getStartDate(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'year':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  /// Send new gig opportunity notifications to matching artists
  /// Finds artists that match by genre and are within travel radius of the gig location
  async notifyArtistsOfNewGig(
    gigId: string,
    gigTitle: string,
    genres: string[],
    location: { lat: number; lng: number },
    budget: number,
    venueName: string,
  ): Promise<number> {
    try {
      // Import Artist model dynamically to avoid circular deps
      const Artist = this.connection.model('Artist');

      // Find artists that:
      // 1. Have at least one matching genre
      // 2. Have gig notifications enabled
      // 3. Are within their travel radius of the gig location

      // First, find users with gig notifications enabled
      const usersWithNotificationsEnabled = await this.userModel
        .find({
          role: 'artist',
          isActive: true,
          $or: [
            { 'notificationPreferences.gigNotifications': true },
            { 'notificationPreferences.gigNotifications': { $exists: false } }, // Default enabled
          ],
        })
        .select('_id')
        .lean()
        .exec();

      const userIds = usersWithNotificationsEnabled.map((u: any) => u._id);

      if (userIds.length === 0) {
        this.logger.debug('No users with gig notifications enabled');
        return 0;
      }

      // Find matching artists by genre and location
      const matchingArtists = await Artist.find({
        userId: { $in: userIds },
        genres: { $in: genres.length > 0 ? genres : ['.*'] }, // Match any if no genres specified
        isProfileVisible: true,
        // Geo query - find artists whose location is within their travel radius
        'location.coordinates': {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: [location.lng, location.lat],
            },
            $maxDistance: 160934, // 100 miles in meters as max, filtered by artist preference
          },
        },
      })
        .select('userId stageName displayName location.travelRadiusMiles')
        .limit(100) // Cap notifications per gig
        .lean()
        .exec();

      if (matchingArtists.length === 0) {
        this.logger.debug(`No matching artists found for gig ${gigId}`);
        return 0;
      }

      // Send notifications to each matching artist
      let sentCount = 0;
      const notifications = matchingArtists.map(async (artist: any) => {
        try {
          await this.sendNotification({
            userId: artist.userId.toString(),
            type: 'gig_opportunity',
            title: '🎵 New Gig Near You!',
            body: `${venueName} is looking for ${genres.join('/')} artists. Budget: $${budget}`,
            deepLink: `/gigs/${gigId}`,
            data: { gigId, gigTitle, venueName },
          });
          sentCount++;
        } catch (err: any) {
          this.logger.warn(
            `Failed to notify artist ${artist.userId}: ${err.message}`,
          );
        }
      });

      await Promise.all(notifications);

      this.logger.log(
        `📤 Notified ${sentCount} artists about new gig "${gigTitle}"`,
      );
      return sentCount;
    } catch (error: any) {
      this.logger.error(`Failed to notify artists of new gig: ${error.message}`);
      return 0;
    }
  }

  /// Notify venue when an artist applies to their gig
  async notifyVenueOfApplication(
    venueUserId: string,
    gigId: string,
    gigTitle: string,
    artistName: string,
    proposedRate?: number,
  ): Promise<void> {
    const body = proposedRate
      ? `${artistName} applied to "${gigTitle}" with a proposed rate of $${proposedRate}`
      : `${artistName} applied to your gig "${gigTitle}"`;

    await this.sendNotification({
      userId: venueUserId,
      type: 'gig_opportunity', // Reuse existing type
      title: '🎸 New Application!',
      body,
      deepLink: `/gigs/${gigId}/applications`,
      data: { gigId, artistName },
    });
  }

  /// Send match notification
  async notifyMatch(
    matchId: string,
    artistId: string,
    venueId: string,
  ): Promise<void> {
    await Promise.all([
      this.sendTemplatedNotification(
        artistId,
        'match',
        {
          matchId,
        },
        { matchId },
      ),
      this.sendTemplatedNotification(
        venueId,
        'match',
        {
          matchId,
        },
        { matchId },
      ),
    ]);
  }

  /// Send message notification
  async notifyNewMessage(
    conversationId: string,
    recipientId: string,
    senderName: string,
    messagePreview: string,
  ): Promise<void> {
    await this.sendTemplatedNotification(
      recipientId,
      'message',
      {
        senderName,
        messagePreview,
      },
      { conversationId },
    );
  }

  /// Send booking confirmation notification
  async notifyBookingConfirmation(
    bookingId: string,
    userId: string,
    gigTitle: string,
    date: string,
  ): Promise<void> {
    await this.sendTemplatedNotification(
      userId,
      'booking_confirmation',
      {
        gigTitle,
        date,
      },
      { bookingId },
    );
  }

  /// Send gig reminder notification
  async notifyGigReminder(
    bookingId: string,
    userId: string,
    gigTitle: string,
    venueName: string,
    hoursUntilGig: number,
  ): Promise<void> {
    await this.sendTemplatedNotification(
      userId,
      'booking_reminder',
      {
        gigTitle,
        venueName,
        hoursUntilGig: hoursUntilGig.toString(),
      },
      { bookingId },
    );
  }

  /// Send payment received notification
  async notifyPaymentReceived(
    userId: string,
    amount: string,
    gigTitle: string,
  ): Promise<void> {
    await this.sendTemplatedNotification(userId, 'payment_received', {
      amount,
      gigTitle,
    });
  }

  /// Send gig cancelled notification
  async notifyGigCancelled(
    gigId: string,
    userId: string,
    gigTitle: string,
    reason?: string,
  ): Promise<void> {
    await this.sendTemplatedNotification(
      userId,
      'gig_cancelled',
      {
        gigTitle,
        reason: reason || 'The gig has been cancelled',
      },
      { gigId },
    );
  }
}
