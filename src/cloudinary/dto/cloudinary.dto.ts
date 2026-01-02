import { IsString, IsOptional, IsEnum, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetSignedUploadDto {
  @ApiPropertyOptional({
    enum: ['image', 'video', 'raw'],
    default: 'image',
    description: 'Type of resource to upload',
  })
  @IsOptional()
  @IsEnum(['image', 'video', 'raw'])
  resourceType?: 'image' | 'video' | 'raw' = 'image';
}

export class ServerUploadDto {
  @ApiProperty({
    description: 'Base64 encoded file or URL',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
  })
  @IsString()
  @IsNotEmpty()
  file: string;

  @ApiPropertyOptional({
    description: 'Index for gallery images',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  index?: number;
}

export class DeleteFileDto {
  @ApiProperty({
    description: 'Cloudinary public ID of the file to delete',
    example: 'gigmatch/profiles/profile_123456',
  })
  @IsString()
  @IsNotEmpty()
  publicId: string;

  @ApiPropertyOptional({
    enum: ['image', 'video', 'raw'],
    default: 'image',
    description: 'Type of resource',
  })
  @IsOptional()
  @IsEnum(['image', 'video', 'raw'])
  resourceType?: 'image' | 'video' | 'raw' = 'image';
}
