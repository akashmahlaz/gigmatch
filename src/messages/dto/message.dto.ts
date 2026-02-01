import {
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class AttachmentDto {
  @ApiProperty({ enum: ['image', 'audio', 'document'] })
  @IsEnum(['image', 'audio', 'document'])
  type: 'image' | 'audio' | 'document';

  @ApiProperty()
  @IsString()
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  size?: number;
}

export class SendMessageDto {
  @ApiProperty()
  @IsMongoId()
  matchId: string;

  @ApiPropertyOptional({ enum: ['text', 'image', 'audio', 'booking_request'] })
  @IsOptional()
  @IsEnum(['text', 'image', 'audio', 'booking_request'])
  messageType?: 'text' | 'image' | 'audio' | 'booking_request';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ type: [AttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  replyTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  replyToMessageId?: string;

  @ApiPropertyOptional({ description: 'Additional metadata for the message' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class GetMessagesDto {
  @ApiProperty()
  @IsMongoId()
  matchId: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Get messages before this ID' })
  @IsOptional()
  @IsMongoId()
  before?: string;
}

export class MarkMessagesReadDto {
  @ApiProperty()
  @IsMongoId()
  matchId: string;

  @ApiPropertyOptional({ type: [String], description: 'Specific message IDs to mark read' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  messageIds?: string[];
}

// WebSocket Events
export class WsJoinRoomDto {
  @ApiProperty()
  matchId: string;
}

export class WsLeaveRoomDto {
  @ApiProperty()
  matchId: string;
}

export class WsTypingDto {
  @ApiProperty()
  matchId: string;

  @ApiProperty()
  isTyping: boolean;
}

export class WsMessageDto {
  @ApiProperty()
  matchId: string;

  @ApiPropertyOptional()
  content?: string;

  @ApiPropertyOptional()
  messageType?: string;

  @ApiPropertyOptional()
  attachments?: AttachmentDto[];
}
