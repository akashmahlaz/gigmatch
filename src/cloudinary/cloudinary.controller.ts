import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../schemas/user.schema';
import { CloudinaryService } from './cloudinary.service';
import type { SignedUploadParams, UploadResult } from './cloudinary.service';
import { GetSignedUploadDto, ServerUploadDto } from './dto/cloudinary.dto';

@ApiTags('Media Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  /**
   * Get signed upload parameters for client-side direct upload
   * Client uses these params to upload directly to Cloudinary
   */
  @Post('signed-params')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get signed parameters for client-side upload' })
  @ApiResponse({ status: 200, description: 'Signed upload parameters' })
  getSignedUploadParams(
    @CurrentUser() user: UserPayload,
    @Body() dto: GetSignedUploadDto,
  ): SignedUploadParams {
    const folder = `${user.role}s/${user._id}`;
    return this.cloudinaryService.generateSignedUploadParams(
      folder,
      dto.resourceType,
    );
  }

  /**
   * Upload profile photo (server-side)
   */
  @Post('profile-photo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload profile photo' })
  @ApiResponse({ status: 200, description: 'Upload successful' })
  async uploadProfilePhoto(
    @CurrentUser() user: UserPayload,
    @Body() dto: ServerUploadDto,
  ): Promise<UploadResult> {
    return this.cloudinaryService.uploadProfilePhoto(
      dto.file,
      user._id.toString(),
    );
  }

  /**
   * Upload gallery image (server-side)
   */
  @Post('gallery')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload gallery image' })
  @ApiResponse({ status: 200, description: 'Upload successful' })
  async uploadGalleryImage(
    @CurrentUser() user: UserPayload,
    @Body() dto: ServerUploadDto,
  ): Promise<UploadResult> {
    return this.cloudinaryService.uploadGalleryImage(
      dto.file,
      user._id.toString(),
      dto.index || 0,
    );
  }

  /**
   * Upload audio sample (server-side)
   */
  @Post('audio')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload audio sample' })
  @ApiResponse({ status: 200, description: 'Upload successful' })
  async uploadAudioSample(
    @CurrentUser() user: UserPayload,
    @Body() dto: ServerUploadDto,
  ): Promise<UploadResult> {
    return this.cloudinaryService.uploadAudioSample(
      dto.file,
      user._id.toString(),
    );
  }

  /**
   * Upload video sample (server-side)
   */
  @Post('video')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload video sample' })
  @ApiResponse({ status: 200, description: 'Upload successful' })
  async uploadVideoSample(
    @CurrentUser() user: UserPayload,
    @Body() dto: ServerUploadDto,
  ): Promise<UploadResult> {
    return this.cloudinaryService.uploadVideoSample(
      dto.file,
      user._id.toString(),
    );
  }
}
