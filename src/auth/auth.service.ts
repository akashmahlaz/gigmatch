import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
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
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Artist.name) private artistModel: Model<ArtistDocument>,
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, fullName, role, phone } = registerDto;

    // Check if user exists
    const existingUser = await this.userModel.findOne({ email }).exec();
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new this.userModel({
      email,
      password: hashedPassword,
      fullName,
      role,
      phone,
      isActive: true,
      isEmailVerified: false,
      emailVerificationToken: randomBytes(32).toString('hex'),
    });

    await user.save();

    // Create profile based on role
    let profileId: string | undefined;

    if (role === 'artist') {
      const artist = new this.artistModel({
        user: user._id,
        displayName: fullName,
        phone,
        isProfileVisible: false,
        hasCompletedSetup: false,
      });
      await artist.save();
      profileId = artist._id.toString();

      // Update user with artist reference
      user.artistProfile = artist._id;
      await user.save();

      // Create free subscription for artist
      const subscription = new this.subscriptionModel({
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
      await subscription.save();
    } else if (role === 'venue') {
      const venue = new this.venueModel({
        user: user._id,
        venueName: fullName,
        venueType: 'bar',
        location: { city: '', country: '' },
        phone,
        isProfileVisible: false,
        hasCompletedSetup: false,
      });
      await venue.save();
      profileId = venue._id.toString();

      // Update user with venue reference
      user.venueProfile = venue._id;
      await user.save();
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Update user with refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return {
      ...tokens,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        profileId,
        hasCompletedSetup: false,
      },
    };
  }

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string): Promise<UserDocument | null> {
    const user = await this.userModel.findOne({ email }).select('+password').exec();

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
      },
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthTokens> {
    const { refreshToken } = refreshTokenDto;

    try {
      const payload = this.jwtService.verify(refreshToken, {
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
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const { email } = forgotPasswordDto;

    const user = await this.userModel.findOne({ email }).exec();

    if (!user) {
      // Don't reveal if email exists
      return;
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetTokenExpiry;
    await user.save();

    // TODO: Send email with reset link
    // For now, just log the token (remove in production)
    console.log(`Password reset token for ${email}: ${resetToken}`);
  }

  /**
   * Reset password with token
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
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
    user.refreshToken = undefined;
    await user.save();
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.userModel
      .findById(userId)
      .select('+password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.refreshToken = undefined; // Invalidate all sessions
    await user.save();
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
