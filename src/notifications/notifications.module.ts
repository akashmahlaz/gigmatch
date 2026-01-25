/// 🔔 GigMatch Notifications Module
/// 
/// Provides notification functionality including:
/// - Push notifications via FCM
/// - In-app notification storage
/// - Notification preferences
/// - Device token management

import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { firebaseProvider } from './firebase.provider';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import {
  DeviceToken,
  DeviceTokenSchema,
} from './schemas/device-token.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: DeviceToken.name, schema: DeviceTokenSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, firebaseProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
