/// 📅 GIGMATCH Bookings DTOs
///
/// Data Transfer Objects for booking operations
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  IsMongoId,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBookingDto {
  @IsMongoId()
  @IsNotEmpty()
  artistId: string;

  @IsMongoId()
  @IsNotEmpty()
  venueId: string;

  @IsMongoId()
  @IsOptional()
  matchId?: string;

  @IsMongoId()
  @IsOptional()
  gigId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsNumber()
  @IsOptional()
  @Min(15)
  durationMinutes?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  numberOfSets?: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  agreedAmount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  depositAmount?: number;

  @IsString()
  @IsOptional()
  specialRequests?: string;

  @IsString()
  @IsOptional()
  additionalTerms?: string;
}

export class UpdateBookingDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsNumber()
  @IsOptional()
  @Min(15)
  durationMinutes?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  numberOfSets?: number;

  @IsString()
  @IsOptional()
  specialRequests?: string;

  @IsString()
  @IsOptional()
  additionalTerms?: string;
}

export class CancelBookingDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ConfirmPaymentDto {
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;
}

export class UploadContractDto {
  @IsString()
  @IsNotEmpty()
  contractUrl: string;
}

export class BookingQueryDto {
  @IsOptional()
  @IsEnum([
    'pending',
    'confirmed',
    'deposit_paid',
    'paid',
    'in_progress',
    'completed',
    'cancelled',
    'disputed',
  ])
  status?: string;

  @IsOptional()
  upcoming?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  skip?: number;
}
