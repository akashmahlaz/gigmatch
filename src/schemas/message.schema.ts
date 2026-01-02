import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

/**
 * 💬 MESSAGE SCHEMA
 *
 * Chat messages between matched artists and venues.
 * Supports text, images, audio, and booking-related messages.
 */
@Schema({
  timestamps: true,
  collection: 'messages',
})
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Match', required: true })
  match: Types.ObjectId;

  // Sender
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ required: true, enum: ['artist', 'venue'] })
  senderType: 'artist' | 'venue';

  // Content
  @Prop({
    required: true,
    enum: ['text', 'image', 'audio', 'booking_request', 'booking_update', 'system'],
  })
  messageType: 'text' | 'image' | 'audio' | 'booking_request' | 'booking_update' | 'system';

  @Prop()
  content?: string;

  // Media attachments
  @Prop(
    raw([
      {
        type: { type: String, enum: ['image', 'audio', 'document'] },
        url: { type: String, required: true },
        filename: { type: String },
        size: { type: Number },
      },
    ]),
  )
  attachments: {
    type: 'image' | 'audio' | 'document';
    url: string;
    filename?: string;
    size?: number;
  }[];

  // Booking reference (for booking-related messages)
  @Prop({ type: Types.ObjectId, ref: 'Booking' })
  relatedBooking?: Types.ObjectId;

  // Read status
  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  readAt?: Date;

  // Delivery status
  @Prop({
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending',
  })
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

  // Deletion
  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({ enum: ['sender', 'admin'] })
  deletedBy?: 'sender' | 'admin';

  // Reply to
  @Prop({ type: Types.ObjectId, ref: 'Message' })
  replyTo?: Types.ObjectId;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Indexes for efficient chat queries
MessageSchema.index({ match: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ match: 1, isRead: 1 });
MessageSchema.index({ createdAt: -1 });
