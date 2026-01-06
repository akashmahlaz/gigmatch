import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { User, UserDocument } from '../schemas/user.schema';
import { Artist, ArtistDocument } from '../schemas/artist.schema';
import { Venue, VenueDocument } from '../schemas/venue.schema';
import {
  Subscription,
  SubscriptionDocument,
} from '../schemas/subscription.schema';
import {
  RegisterDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import { EmailService } from '../email/email.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    profileId?: string;
    hasCompletedSetup: boolean;
    isEmailVerified: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Artist.name) private artistModel: Model<ArtistDocument>,
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  /**
   * Register a new user with race condition protection
   * Uses unique index on email for atomic duplicate prevention
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, fullName, role, phone } = registerDto;

    // Hash password first
    const hashedPassword = await bcrypt.hash(password, 12);
    const emailVerificationToken = randomBytes(32).toString('hex');

    let user: UserDocument;
    let profileId: string | undefined;

    try {
      // Check if user exists first
      const existingUser = await this.userModel.findOne({ email }).exec();

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Create user - the unique index on email will prevent duplicates atomically
      user = await this.userModel.create({
        email,
        password: hashedPassword,
        fullName,
        role,
        phone,
        isActive: true,
        isEmailVerified: false,
        emailVerificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      // Create profile based on role
      if (role === 'artist') {
        const artist = await this.artistModel.create({
          user: user._id,
          displayName: fullName,
          phone,
          isProfileVisible: false,
          hasCompletedSetup: false,
        });
        profileId = artist._id.toString();

        // Update user with artist reference
        user.artistProfile = artist._id;
        await user.save();

        // Create free subscription for artist
        await this.subscriptionModel.create({
          user: user._id,
          artist: artist._id,
          plan: 'free',
          status: 'active',
          features: {
            dailySwipeLimit: 10,
            canSeeWhoLikedYou: false,
            boostsPerMonth: 0,
            priorityInSearch: false,
            advancedAnalytics: false,
            customProfileUrl: false,
            verifiedBadge: false,
            unlimitedMessages: true,
          },
        });
      } else if (role === 'venue') {
        const venue = await this.venueModel.create({
          user: user._id,
          venueName: fullName,
          venueType: 'bar',
          location: { city: '', country: '' },
          phone,
          isProfileVisible: false,
          hasCompletedSetup: false,
        });
        profileId = venue._id.toString();

        // Update user with venue reference
        user.venueProfile = venue._id;
        await user.save();
      }
    } catch (error: unknown) {
      // Handle MongoDB duplicate key error (race condition protection)
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new ConflictException('User with this email already exists');
      }

      // If it's already a NestJS exception, rethrow it
      if (error instanceof ConflictException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Registration failed for ${email}: ${errorMessage}`, errorStack);
      this.logger.error(`Full error object: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
      throw new InternalServerErrorException(
        `Registration failed: ${errorMessage}`,
      );
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Update user with refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    // Send verification email (non-blocking)
    this.emailService
      .sendVerificationEmail(email, emailVerificationToken, fullName)
      .then((sent) => {
        if (sent) {
          this.logger.log(`Verification email sent to ${email}`);
        } else {
          this.logger.warn(`Failed to send verification email to ${email}`);
        }
      })
      .catch((err: unknown) =>
        this.logger.error(
          `Email error: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );

    return {
      ...tokens,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        profileId,
        hasCompletedSetup: false,
        isEmailVerified: false,
      },
    };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.userModel
      .findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() },
      })
      .exec();

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Send welcome email (non-blocking)
    this.emailService
      .sendWelcomeEmail(user.email, user.fullName, user.role)
      .catch((err: unknown) =>
        this.logger.error(
          `Welcome email error: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );

    return { message: 'Email verified successfully' };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email }).exec();

    if (!user) {
      // Don't reveal if email exists
      return {
        message: 'If the email exists, a verification link has been sent.',
      };
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new token
    const emailVerificationToken = randomBytes(32).toString('hex');
    user.emailVerificationToken = emailVerificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // Send verification email
    await this.emailService.sendVerificationEmail(
      email,
      emailVerificationToken,
      user.fullName,
    );

    return {
      message: 'If the email exists, a verification link has been sent.',
    };
  }

  /**
   * Validate user credentials
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<UserDocument | null> {
    const user = await this.userModel
      .findOne({ email })
      .select('+password')
      .exec();

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  /**
   * Login user
   */
  async login(user: UserDocument): Promise<AuthResponse> {
    const tokens = await this.generateTokens(user);

    // Update refresh token and last login
    user.refreshToken = tokens.refreshToken;
    user.lastLoginAt = new Date();
    await user.save();

    // Get profile ID
    let profileId: string | undefined;
    let hasCompletedSetup = false;

    if (user.role === 'artist' && user.artistProfile) {
      const artist = await this.artistModel.findById(user.artistProfile).exec();
      profileId = artist?._id.toString();
      hasCompletedSetup = artist?.hasCompletedSetup ?? false;
    } else if (user.role === 'venue' && user.venueProfile) {
      const venue = await this.venueModel.findById(user.venueProfile).exec();
      profileId = venue?._id.toString();
      hasCompletedSetup = venue?.hasCompletedSetup ?? false;
    }

    return {
      ...tokens,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        profileId,
        hasCompletedSetup,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthTokens> {
    const { refreshToken } = refreshTokenDto;

    try {
      const payload = this.jwtService.verify<{ sub: string; email: string; role: string }>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userModel.findById(payload.sub).exec();

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user);

      // Update refresh token
      user.refreshToken = tokens.refreshToken;
      await user.save();

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $unset: { refreshToken: 1 },
    });
  }

  /**
   * Forgot password - send reset email
   */
  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    const user = await this.userModel.findOne({ email }).exec();

    if (!user) {
      // Don't reveal if email exists - always return success message
      return {
        message:
          'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetTokenExpiry;
    await user.save();

    // Send password reset email
    const emailSent = await this.emailService.sendPasswordResetEmail(
      email,
      resetToken,
      user.fullName,
    );

    if (!emailSent) {
      this.logger.error(`Failed to send password reset email to ${email}`);
    } else {
      this.logger.log(`Password reset email sent to ${email}`);
    }

    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordDto;

    const user = await this.userModel
      .findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() },
      })
      .exec();

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken = undefined; // Invalidate all sessions
    await user.save();

    this.logger.log(`Password reset successful for ${user.email}`);

    return {
      message:
        'Password has been reset successfully. You can now log in with your new password.',
    };
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.userModel
      .findById(userId)
      .select('+password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.refreshToken = undefined; // Invalidate all sessions
    await user.save();

    return { message: 'Password changed successfully' };
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let profile: any = null;

    if (user.role === 'artist' && user.artistProfile) {
      profile = await this.artistModel.findById(user.artistProfile).exec();
    } else if (user.role === 'venue' && user.venueProfile) {
      profile = await this.venueModel.findById(user.venueProfile).exec();
    }

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      profile,
    };
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(user: UserDocument): Promise<AuthTokens> {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: 900, // 15 minutes in seconds
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: 604800, // 7 days in seconds
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }
}
