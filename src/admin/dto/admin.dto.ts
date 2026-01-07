import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateUserDto {
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

  @ApiProperty({ enum: ['artist', 'venue', 'admin'], example: 'artist' })
  @IsEnum(['artist', 'venue', 'admin'])
  role: 'artist' | 'venue' | 'admin';

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'SecureP@ss123' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ enum: ['artist', 'venue', 'admin'] })
  @IsOptional()
  @IsEnum(['artist', 'venue', 'admin'])
  role?: 'artist' | 'venue' | 'admin';

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isBanned?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;
}

export class QueryUsersDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ enum: ['artist', 'venue', 'admin'] })
  @IsOptional()
  @IsEnum(['artist', 'venue', 'admin'])
  role?: 'artist' | 'venue' | 'admin';

  @ApiPropertyOptional({ enum: ['active', 'banned', 'inactive'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'john' })
  @IsOptional()
  @IsString()
  search?: string;
}
