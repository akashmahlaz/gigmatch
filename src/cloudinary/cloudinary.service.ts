import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface SignedUploadParams {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
}

export interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width?: number;
  height?: number;
  resourceType: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  /**
   * Generate signed upload parameters for client-side uploads
   * This is more secure than uploading through the server
   */
  generateSignedUploadParams(
    folder: string,
    resourceType: 'image' | 'video' | 'raw' = 'image',
  ): SignedUploadParams {
    const timestamp = Math.round(Date.now() / 1000);
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!apiSecret) {
      throw new BadRequestException('Cloudinary not configured');
    }

    // Parameters to sign
    const paramsToSign = {
      timestamp,
      folder: `gigmatch/${folder}`,
      resource_type: resourceType,
    };

    // Generate signature
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      apiSecret,
    );

    this.logger.log(
      `cloudinary:signed-params folder=gigmatch/${folder} resourceType=${resourceType}`,
    );

    return {
      signature,
      timestamp,
      cloudName: this.configService.get<string>('CLOUDINARY_CLOUD_NAME') || '',
      apiKey: this.configService.get<string>('CLOUDINARY_API_KEY') || '',
      folder: `gigmatch/${folder}`,
    };
  }

  /**
   * Upload file from base64 or URL (server-side upload)
   */
  async uploadFile(
    file: string, // base64 or URL
    folder: string,
    options?: {
      resourceType?: 'image' | 'video' | 'raw';
      transformation?: object;
      publicId?: string;
    },
  ): Promise<UploadResult> {
    try {
      this.logger.log(
        `cloudinary:upload:start folder=${folder} resourceType=${options?.resourceType ?? 'auto'} publicId=${options?.publicId ?? 'auto'}`,
      );
      const result: UploadApiResponse = await cloudinary.uploader.upload(file, {
        folder: `gigmatch/${folder}`,
        resource_type: options?.resourceType || 'auto',
        transformation: options?.transformation,
        public_id: options?.publicId,
      });

      this.logger.log(
        `cloudinary:upload:success folder=${folder} publicId=${result.public_id}`,
      );

      return {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        resourceType: result.resource_type,
      };
    } catch (error) {
      this.logger.error(
        `cloudinary:upload:error folder=${folder}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Upload profile photo with automatic optimization
   */
  async uploadProfilePhoto(
    file: string,
    userId: string,
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'profiles', {
      resourceType: 'image',
      publicId: `profile_${userId}`,
      transformation: {
        width: 500,
        height: 500,
        crop: 'fill',
        gravity: 'face',
        quality: 'auto',
        format: 'auto',
      },
    });
  }

  /**
   * Upload gallery image
   */
  async uploadGalleryImage(
    file: string,
    userId: string,
    index: number,
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'gallery', {
      resourceType: 'image',
      publicId: `gallery_${userId}_${index}_${Date.now()}`,
      transformation: {
        width: 1200,
        height: 1200,
        crop: 'limit',
        quality: 'auto',
        format: 'auto',
      },
    });
  }

  /**
   * Upload audio sample
   */
  async uploadAudioSample(
    file: string,
    userId: string,
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'audio', {
      resourceType: 'raw',
      publicId: `audio_${userId}_${Date.now()}`,
    });
  }

  /**
   * Upload video sample
   */
  async uploadVideoSample(
    file: string,
    userId: string,
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'videos', {
      resourceType: 'video',
      publicId: `video_${userId}_${Date.now()}`,
      transformation: {
        quality: 'auto',
        format: 'mp4',
      },
    });
  }

  /**
   * Delete a file from Cloudinary
   */
  async deleteFile(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      return result.result === 'ok';
    } catch (error) {
      this.logger.error(
        `cloudinary:delete:error publicId=${publicId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  /**
   * Generate optimized URL for an existing image
   */
  getOptimizedUrl(
    publicId: string,
    options?: {
      width?: number;
      height?: number;
      crop?: string;
      format?: string;
    },
  ): string {
    return cloudinary.url(publicId, {
      secure: true,
      transformation: {
        width: options?.width,
        height: options?.height,
        crop: options?.crop || 'fill',
        format: options?.format || 'auto',
        quality: 'auto',
      },
    });
  }
}
