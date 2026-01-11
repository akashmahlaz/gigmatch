/// 📝 REGISTER DATA TRANSFER OBJECT
///
/// Validates and transfers registration data for both Artists and Venues
/// All fields are strictly validated with class-validator

import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  Matches,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/// User role enum for registration
export enum UserRole {
  ARTIST = 'artist',
  VENUE = 'venue',
}

/// ════════════════════════════════════════════════════════════════════
/// ARTIST REGISTRATION DTO
/// ════════════════════════════════════════════════════════════════════

export class RegisterArtistDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'Artist email address',
    format: 'email',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description: 'Password with at least 8 characters, 1 uppercase, 1 lowercase, 1 number',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message:
        'Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character',
    },
  )
  password: string;

  @ApiProperty({
    example: 'John Smith',
    description: 'Display name or full name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Display name is required' })
  @MinLength(2, { message: 'Display name must be at least 2 characters' })
  @MaxLength(100, { message: 'Display name must not exceed 100 characters' })
  @Matches(/^[a-zA-Z0-9\s\-'.,]+$/, {
    message: 'Display name contains invalid characters',
  })
  displayName: string;

  @ApiProperty({
    example: 'artist',
    description: 'User role - must be artist',
    enum: UserRole,
  })
  @IsEnum(UserRole, { message: 'Role must be either artist or venue' })
  role: UserRole.ARTIST;

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Phone number for quick contact',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Please provide a valid phone number',
  })
  phone?: string;

  @ApiProperty({
    example: true,
    description: 'Accept terms and conditions',
  })
  @IsBoolean()
  @IsNotEmpty({ message: 'You must accept the terms and conditions' })
  acceptTerms: boolean;

  @ApiPropertyOptional({
    example: 'google',
    description: 'OAuth provider if registering via social login',
    enum: ['google', 'apple', 'facebook'],
  })
  @IsOptional()
  @IsString()
  oauthProvider?: 'google' | 'apple' | 'facebook';

  @ApiPropertyOptional({
    description: 'OAuth access token for social login',
  })
  @IsOptional()
  @IsString()
  oauthAccessToken?: string;
}

/// ══════════════════════════════════════════
/// VENUE REGISTRATION══════════════════════════ DTO
/// ════════════════════════════════════════════════════════════════════

export class RegisterVenueDto {
  @ApiProperty({
    example: 'venue@example.com',
    description: 'Venue email address',
    format: 'email',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description: 'Password with at least 8 characters, 1 uppercase, 1 lowercase, 1 number',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message:
        'Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character',
    },
  )
  password: string;

  @ApiProperty({
    example: 'The Blue Note Jazz Club',
    description: 'Official venue name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Venue name is required' })
  @MinLength(2, { message: 'Venue name must be at least 2 characters' })
  @MaxLength(200, { message: 'Venue name must not exceed 200 characters' })
  venueName: string;

  @ApiProperty({
    example: 'venue',
    description: 'User role - must be venue',
    enum: UserRole,
  })
  @IsEnum(UserRole, { message: 'Role must be either artist or venue' })
  role: UserRole.VENUE;

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Contact phone number',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Please provide a valid phone number',
  })
  phone?: string;

  @ApiProperty({
    example: true,
    description: 'Accept terms and conditions',
  })
  @IsBoolean()
  @IsNotEmpty({ message: 'You must accept the terms and conditions' })
  acceptTerms: boolean;

  @ApiPropertyOptional({
    example: 'google',
    description: 'OAuth provider if registering via social login',
    enum: ['google', 'apple', 'facebook'],
  })
  @IsOptional()
  @IsString()
  oauthProvider?: 'google' | 'apple' | 'facebook';

  @ApiPropertyOptional({
    description: 'OAuth access token for social login',
  })
  @IsOptional()
  @IsString()
  oauthAccessToken?: string;
}

/// ════════════════════════════════════════════════════════════════════
/// UNION TYPE FOR REGISTRATION
/// ════════════════════════════════════════════════════════════════════

export type RegisterDto = RegisterArtistDto | RegisterVenueDto;
