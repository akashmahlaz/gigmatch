/// 📱 Device Token Schema for Push Notifications
/// Stores FCM device tokens for push notification delivery

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DevicePlatform {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web',
}

@Schema({
  timestamps: true,
  collection: 'device_tokens',
})
export class DeviceToken {
  @ApiProperty({ description: 'User ID who owns this device token' })
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @ApiProperty({ description: 'FCM device token' })
  @Prop({ type: String, required: true, unique: true })
  token: string;

  @ApiProperty({ enum: DevicePlatform, description: 'Device platform' })
  @Prop({
    type: String,
    enum: Object.values(DevicePlatform),
    required: true,
  })
  platform: DevicePlatform;

  @ApiPropertyOptional({ description: 'Device model' })
  @Prop({ type: String })
  deviceModel?: string;

  @ApiPropertyOptional({ description: 'Device OS version' })
  @Prop({ type: String })
  osVersion?: string;

  @ApiPropertyOptional({ description: 'App version' })
  @Prop({ type: String })
  appVersion?: string;

  @ApiProperty({ description: 'Whether this token is active' })
  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Last used timestamp' })
  @Prop({ type: Date })
  lastUsedAt?: Date;
}

export type DeviceTokenDocument = DeviceToken & Document;
export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceToken);

// Index for efficient lookups
DeviceTokenSchema.index({ userId: 1, isActive: 1 });
DeviceTokenSchema.index({ token: 1 }, { unique: true });
