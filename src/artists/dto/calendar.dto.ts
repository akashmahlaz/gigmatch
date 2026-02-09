/// 📅 Artist Calendar DTOs
/// Handles availability management for artists
import {
  IsDateString,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  Matches,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Availability slot type
 */
export enum AvailabilityType {
  AVAILABLE = 'available',
  BLOCKED = 'blocked',
  BOOKED = 'booked',
}

/**
 * Single availability slot
 */
export class AvailabilitySlotDto {
  @ApiProperty({ example: '2026-01-25', description: 'Date in YYYY-MM-DD format' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '19:00', description: 'Start time (HH:MM 24-hour format)' })
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Start time must be in HH:MM format (24-hour)',
  })
  startTime: string;

  @ApiProperty({ example: '23:00', description: 'End time (HH:MM 24-hour format)' })
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'End time must be in HH:MM format (24-hour)',
  })
  endTime: string;

  @ApiPropertyOptional({ enum: AvailabilityType, default: AvailabilityType.AVAILABLE })
  @IsOptional()
  @IsEnum(AvailabilityType)
  type?: AvailabilityType;

  @ApiPropertyOptional({ description: 'Notes for this slot' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Is this a recurring slot' })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ description: 'Is this an overnight gig (ends next day)' })
  @IsOptional()
  @IsBoolean()
  isOvernight?: boolean;

  @ApiPropertyOptional({ description: 'User timezone (e.g., "GMT", "EST", "PST")' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Start time as UTC ISO string for unambiguous handling' })
  @IsOptional()
  @IsDateString()
  startDateTimeUtc?: string;

  @ApiPropertyOptional({ description: 'End time as UTC ISO string for unambiguous handling' })
  @IsOptional()
  @IsDateString()
  endDateTimeUtc?: string;
}

/**
 * Update availability request - replaces all availability for given date range
 */
export class UpdateAvailabilityDto {
  @ApiProperty({ type: [AvailabilitySlotDto], description: 'Availability slots to set' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots: AvailabilitySlotDto[];
}

/**
 * Add single availability slot
 */
export class AddAvailabilityDto extends AvailabilitySlotDto {}

/**
 * Remove availability by date or specific slotId
 */
export class RemoveAvailabilityDto {
  @ApiProperty({ example: '2026-01-25', description: 'Date to remove availability for' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'Specific slot ID to remove (if not provided, removes all for the date)' })
  @IsOptional()
  @IsString()
  slotId?: string;
}

/**
 * Query params for getting availability
 */
export class GetAvailabilityQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Start date for range query' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-01-31', description: 'End date for range query' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * Calendar event response (includes gigs and availability)
 */
export class CalendarEventDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  date: string;

  @ApiProperty()
  startTime: string;

  @ApiProperty()
  endTime: string;

  @ApiProperty({ enum: ['availability', 'gig', 'blocked'] })
  eventType: 'availability' | 'gig' | 'blocked';

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  venueName?: string;

  @ApiPropertyOptional()
  venueId?: string;

  @ApiPropertyOptional()
  gigId?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  payment?: number;
}

/**
 * Full calendar response with events and stats
 */
export class CalendarResponseDto {
  @ApiProperty({ type: [CalendarEventDto] })
  events: CalendarEventDto[];

  @ApiProperty({ description: 'Number of available slots' })
  availableCount: number;

  @ApiProperty({ description: 'Number of booked gigs' })
  bookedCount: number;

  @ApiProperty({ description: 'Number of blocked dates' })
  blockedCount: number;
}
