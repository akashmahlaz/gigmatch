import {
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetMatchesDto {
  @ApiPropertyOptional({ enum: ['active', 'archived', 'blocked'] })
  @IsOptional()
  @IsEnum(['active', 'archived', 'blocked'])
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateMatchDto {
  @ApiPropertyOptional({ enum: ['active', 'archived', 'blocked'] })
  @IsOptional()
  @IsEnum(['active', 'archived', 'blocked'])
  status?: string;
}

export class MatchWithDetailsDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  matchedAt: Date;

  @ApiProperty()
  status: string;

  @ApiProperty()
  otherUser: {
    id: string;
    name: string;
    profilePhoto?: string;
    type: 'artist' | 'venue';
    profileId: string;
  };

  @ApiPropertyOptional()
  lastMessage?: {
    content: string;
    sentAt: Date;
    isRead: boolean;
  };

  @ApiProperty()
  unreadCount: number;

  @ApiProperty()
  isMuted: boolean;
}
