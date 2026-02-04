import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecureP@ss123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase, one lowercase, one number and one special character',
  })
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ enum: ['artist', 'venue'], example: 'artist' })
  @IsEnum(['artist', 'venue'])
  role: 'artist' | 'venue';

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'New York' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'United States' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 40.7128 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: -74.0060 })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'NewSecureP@ss123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase, one lowercase, one number and one special character',
  })
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: 'NewSecureP@ss123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase, one lowercase, one number and one special character',
  })
  newPassword: string;
}

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google ID token from client SDK' })
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiPropertyOptional({ enum: ['artist', 'venue'] })
  @IsOptional()
  @IsEnum(['artist', 'venue'])
  role?: 'artist' | 'venue';

  @ApiPropertyOptional({ description: 'User email from Google (optional, extracted from token)' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'User display name from Google' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'User profile photo URL from Google' })
  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class AppleAuthDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ enum: ['artist', 'venue'] })
  @IsOptional()
  @IsEnum(['artist', 'venue'])
  role?: 'artist' | 'venue';
}

/// ═══════════════════════════════════════════════════════════════════════
/// UPDATE PROFILE DTO
/// ═══════════════════════════════════════════════════════════════════════

import { IsBoolean } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://example.com/photo.jpg' })
  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  // Notification Preferences (flat structure for mobile compatibility)
  @ApiPropertyOptional({ description: 'Enable push notifications' })
  @IsOptional()
  @IsBoolean()
  pushNotificationsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable email notifications' })
  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable match notifications' })
  @IsOptional()
  @IsBoolean()
  matchNotificationsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable message notifications' })
  @IsOptional()
  @IsBoolean()
  messageNotificationsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable gig reminders' })
  @IsOptional()
  @IsBoolean()
  gigRemindersEnabled?: boolean;

  // Privacy Settings
  @ApiPropertyOptional({ description: 'Show online status to others' })
  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;

  @ApiPropertyOptional({ description: 'Show distance on profile' })
  @IsOptional()
  @IsBoolean()
  showDistance?: boolean;

  @ApiPropertyOptional({ description: 'Maximum discovery distance in miles' })
  @IsOptional()
  @IsNumber()
  maxDistance?: number;
}
