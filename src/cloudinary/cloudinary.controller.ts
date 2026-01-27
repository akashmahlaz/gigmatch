import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
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

  private readonly logger = new Logger(CloudinaryController.name);

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
    this.logger.log(
      `Generating signed upload params for user ${user._id} (${user.role}) with resourceType ${dto.resourceType}`,
    );

    try {
      const folder = `${user.role}s/${user._id}`;
      const params = this.cloudinaryService.generateSignedUploadParams(
        folder,
        dto.resourceType,
      );

      this.logger.log(
        `Generated signed upload params for user ${user._id} (${user.role})`,
      );

      return params;
    } catch (error) {
      this.logger.error(
        `Failed to generate signed upload params for user ${user._id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
    this.logger.log(`Uploading profile photo for user ${user._id}`);

    try {
      const result = await this.cloudinaryService.uploadProfilePhoto(
        dto.file,
        user._id.toString(),
      );

      this.logger.log(
        `Profile photo uploaded for user ${user._id} (${result.publicId})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Profile photo upload failed for user ${user._id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
    const index = dto.index || 0;
    this.logger.log(`Uploading gallery image ${index} for user ${user._id}`);

    try {
      const result = await this.cloudinaryService.uploadGalleryImage(
        dto.file,
        user._id.toString(),
        index,
      );

      this.logger.log(
        `Gallery image ${index} uploaded for user ${user._id} (${result.publicId})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Gallery image upload failed for user ${user._id} (index ${index}): ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
    this.logger.log(`Uploading audio sample for user ${user._id}`);

    try {
      const result = await this.cloudinaryService.uploadAudioSample(
        dto.file,
        user._id.toString(),
      );

      this.logger.log(
        `Audio sample uploaded for user ${user._id} (${result.publicId})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Audio sample upload failed for user ${user._id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
    this.logger.log(`Uploading video sample for user ${user._id}`);

    try {
      const result = await this.cloudinaryService.uploadVideoSample(
        dto.file,
        user._id.toString(),
      );

      this.logger.log(
        `Video sample uploaded for user ${user._id} (${result.publicId})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Video sample upload failed for user ${user._id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
