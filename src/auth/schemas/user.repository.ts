/// 👤 USER REPOSITORY
///
/// MongoDB repository for user operations with comprehensive query methods
/// Handles user CRUD, role-based queries, email verification, and search

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { User, UserDocument, UserRole, UserStatus } from './user.schema';

export interface UserSearchOptions {
  role?: UserRole;
  status?: UserStatus;
  isEmailVerified?: boolean;
  isProfileComplete?: boolean;
  city?: string;
  country?: string;
  limit?: number;
  skip?: number;
  sortBy?: 'createdAt' | 'name' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface UserCountOptions {
  role?: UserRole;
  status?: UserStatus;
  isEmailVerified?: boolean;
}

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /// ═══════════════════════════════════════════════════════════════════
  /// 🔍 CREATE OPERATIONS
  /// ═══════════════════════════════════════════════════════════════════

  /**
   * Create a new user document
   * @param userData - User data to create
   * @returns Created user document
   */
  async create(userData: Partial<User>): Promise<UserDocument> {
    const user = new this.userModel({
      ...userData,
      status: UserStatus.active,
      isEmailVerified: false,
      isProfileComplete: false,
    });
    return user.save();
  }

  /**
   * Create user with session (for transactions)
   * @param userData - User data to create
   * @param session - MongoDB session for transaction
   * @returns Created user document
   */
  async createWithSession(
    userData: Partial<User>,
    session: ClientSession,
  ): Promise<UserDocument> {
    const user = new this.userModel({
      ...userData,
      status: UserStatus.active,
      isEmailVerified: false,
      isProfileComplete: false,
    });
    return user.save({ session });
  }

  /// ═══════════════════════════════════════════════════════════════════
  /// 🔍 READ OPERATIONS
  /// ═══════════════════════════════════════════════════════════════════

  /**
   * Find user by ID
   * @param id - User ID
   * @returns User document or null
   */
  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  /**
   * Find user by email
   * @param email - User email
   * @returns User document or null
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  /**
   * Find user by email with role check
   * @param email - User email
   * @param role - Expected user role
   * @returns User document or null
   */
  async findByEmailWithRole(
    email: string,
    role: UserRole,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase(), role })
      .exec();
  }

  /**
   * Find user by verification token
   * @param token - Email verification token
   * @returns User document or null
   */
  async findByVerificationToken(
    token: string,
  ): Promise<UserDocument | null> {
    return this.userModel.findOne({ verificationToken: token }).exec();
  }

  /**
   * Find user by reset password token
   * @param token - Password reset token
   * @returns User document or null
   */
  async findByResetPasswordToken(
    token: string,
  ): Promise<UserDocument | null> {
    return this.userModel.findOne({ resetPasswordToken: token }).exec();
  }

  /**
   * Find user by refresh token
   * @param refreshToken - JWT refresh token
   * @returns User document or null
   */
  async findByRefreshToken(
    refreshToken: string,
  ): Promise<UserDocument | null> {
    return this.userModel.findOne({ refreshToken }).exec();
  }

  /**
   * Search users with multiple filters
   * @param options - Search options
   * @returns Array of user documents
   */
  async search(options: UserSearchOptions): Promise<UserDocument[]> {
    const query: Record<string, unknown> = {};

    if (options.role) query.role = options.role;
    if (options.status) query.status = options.status;
    if (options.isEmailVerified !== undefined)
      query.isEmailVerified = options.isEmailVerified;
    if (options.isProfileComplete !== undefined)
      query.isProfileComplete = options.isProfileComplete;

    // Location-based search
    if (options.city) query['location.city'] = new RegExp(options.city, 'i');
    if (options.country)
      query['location.country'] = new RegExp(options.country, 'i');

    const sortField = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

    return this.userModel
      .find(query)
      .sort({ [sortField]: sortOrder })
      .skip(options.skip || 0)
      .limit(options.limit || 20)
      .exec();
  }

  /**
   * Find users by role
   * @param role - User role
   * @param limit - Maximum results
   * @param skip - Skip results
   * @returns Array of user documents
   */
  async findByRole(
    role: UserRole,
    limit = 20,
    skip = 0,
  ): Promise<UserDocument[]> {
    return this.userModel
      .find({ role, status: UserStatus.active })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  /**
   * Find artists with incomplete profiles (for onboarding)
   * @param limit - Maximum results
   * @param skip - Skip results
   * @returns Array of artist documents
   */
  async findIncompleteArtists(
    limit = 20,
    skip = 0,
  ): Promise<UserDocument[]> {
    return this.userModel
      .find({
        role: UserRole.artist,
        isProfileComplete: false,
        status: UserStatus.active,
      })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  /**
   * Find venues with incomplete profiles
   * @param limit - Maximum results
   * @param skip - Skip results
   * @returns Array of venue documents
   */
  async findIncompleteVenues(
    limit = 20,
    skip = 0,
  ): Promise<UserDocument[]> {
    return this.userModel
      .find({
        role: UserRole.venue,
        isProfileComplete: false,
        status: UserStatus.active,
      })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  /// ═══════════════════════════════════════════════════════════════════
  /// 📊 COUNT OPERATIONS
  /// ═══════════════════════════════════════════════════════════════════

  /**
   * Count users matching criteria
   * @param options - Count options
   * @returns Number of matching users
   */
  async count(options: UserCountOptions = {}): Promise<number> {
    const query: Record<string, unknown> = {};

    if (options.role) query.role = options.role;
    if (options.status) query.status = options.status;
    if (options.isEmailVerified !== undefined)
      query.isEmailVerified = options.isEmailVerified;

    return this.userModel.countDocuments(query).exec();
  }

  /**
   * Count artists
   * @returns Number of artist users
   */
  async countArtists(): Promise<number> {
    return this.userModel
      .countDocuments({ role: UserRole.artist })
      .exec();
  }

  /**
   * Count venues
   * @returns Number of venue users
   */
  async countVenues(): Promise<number> {
    return this.userModel
      .countDocuments({ role: UserRole.venue })
      .exec();
  }

  /// ═══════════════════════════════════════════════════════════════════
  /// ✏️ UPDATE OPERATIONS
  /// ═══════════════════════════════════════════════════════════════════

  /**
   * Update user by ID
   * @param id - User ID
   * @param updates - Fields to update
   * @returns Updated user document
   */
  async updateById(
    id: string,
    updates: Partial<User>,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, { $set: updates }, { new: true })
      .exec();
  }

  /**
   * Update user by email
   * @param email - User email
   * @param updates - Fields to update
   * @returns Updated user document
   */
  async updateByEmail(
    email: string,
    updates: Partial<User>,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate(
        { email: email.toLowerCase() },
        { $set: updates },
        { new: true },
      )
      .exec();
  }

  /**
   * Set email verification status
   * @param id - User ID
   * @param verified - Verification status
   * @returns Updated user document
   */
  async setEmailVerified(
    id: string,
    verified = true,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        {
          $set: { isEmailVerified: verified },
          $unset: { verificationToken: '' },
        },
        { new: true },
      )
      .exec();
  }

  /**
   * Set profile completeness
   * @param id - User ID
   * @param complete - Completion status
   * @returns Updated user document
   */
  async setProfileComplete(
    id: string,
    complete = true,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        { $set: { isProfileComplete: complete } },
        { new: true },
      )
      .exec();
  }

  /**
   * Update refresh token
   * @param id - User ID
   * @param refreshToken - New refresh token
   * @returns Updated user document
   */
  async updateRefreshToken(
    id: string,
    refreshToken: string | null,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        { $set: { refreshToken } },
        { new: true },
      )
      .exec();
  }

  /**
   * Set verification token
   * @param id - User ID
   * @param token - Verification token
   * @returns Updated user document
   */
  async setVerificationToken(
    id: string,
    token: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        { $set: { verificationToken: token } },
        { new: true },
      )
      .exec();
  }

  /**
   * Set reset password token
   * @param id - User ID
   * @param token - Reset token
   * @param expiresIn - Token expiration time
   * @returns Updated user document
   */
  async setResetPasswordToken(
    id: string,
    token: string,
    expiresIn: Date,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            resetPasswordToken: token,
            resetPasswordExpires: expiresIn,
          },
        },
        { new: true },
      )
      .exec();
  }

  /**
   * Clear reset password token
   * @param id - User ID
   * @returns Updated user document
   */
  async clearResetPasswordToken(
    id: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        {
          $unset: {
            resetPasswordToken: '',
            resetPasswordExpires: '',
          },
        },
        { new: true },
      )
      .exec();
  }

  /**
   * Update location
   * @param id - User ID
   * @param location - Location data
   * @returns Updated user document
   */
  async updateLocation(
    id: string,
    location: {
      city?: string;
      country?: string;
      coordinates?: [number, number];
    },
  ): Promise<UserDocument | null> {
    const updateData: Record<string, unknown> = {};

    if (location.city) updateData['location.city'] = location.city;
    if (location.country) updateData['location.country'] = location.country;
    if (location.coordinates) updateData['location.coordinates'] = location.coordinates;

    return this.userModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .exec();
  }

  /**
   * Update user status
   * @param id - User ID
   * @param status - New status
   * @returns Updated user document
   */
  async updateStatus(
    id: string,
    status: UserStatus,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, { $set: { status } }, { new: true })
      .exec();
  }

  /// ═══════════════════════════════════════════════════════════════════
  /// 🗑️ DELETE OPERATIONS
  /// ═══════════════════════════════════════════════════════════════════

  /**
   * Soft delete user (set status to deleted)
   * @param id - User ID
   * @returns Updated user document
   */
  async softDelete(id: string): Promise<UserDocument | null> {
    return this.updateStatus(id, UserStatus.deleted);
  }

  /**
   * Hard delete user (permanent)
   * @param id - User ID
   * @returns Delete result
   */
  async hardDelete(id: string): Promise<{ deletedCount: number }> {
    const result = await this.userModel.deleteOne({ _id: id }).exec();
    return { deletedCount: result.deletedCount };
  }

  /**
   * Delete expired verification tokens (cleanup)
   * @returns Number of documents cleaned
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.userModel
      .updateMany(
        {
          verificationToken: { $exists: true },
          createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 24 hours
        },
        { $unset: { verificationToken: '' } },
      )
      .exec();
    return result.modifiedCount;
  }

  /// ═══════════════════════════════════════════════════════════════════
  /// 🔍 UTILITY OPERATIONS
  /// ═══════════════════════════════════════════════════════════════════

  /**
   * Check if email exists
   * @param email - Email to check
   * @returns True if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await this.userModel
      .countDocuments({ email: email.toLowerCase() })
      .exec();
    return count > 0;
  }

  /**
   * Check if email exists for different user
   * @param id - Current user ID to exclude
   * @param email - Email to check
   * @returns True if email exists for another user
   */
  async emailExistsForOtherUser(
    id: string,
    email: string,
  ): Promise<boolean> {
    const count = await this.userModel
      .countDocuments({
        _id: { $ne: id },
        email: email.toLowerCase(),
      })
      .exec();
    return count > 0;
  }

  /**
   * Find users by IDs
   * @param ids - Array of user IDs
   * @returns Array of user documents
   */
  async findByIds(ids: string[]): Promise<UserDocument[]> {
    return this.userModel.find({ _id: { $in: ids } }).exec();
  }

  /**
   * Get user names by IDs (for display purposes)
   * @param ids - Array of user IDs
   * @returns Map of ID to name
   */
  async getNamesByIds(ids: string[]): Promise<Map<string, string>> {
    const users = await this.userModel
      .find({ _id: { $in: ids } })
      .select('name role')
      .exec();

    const nameMap = new Map<string, string>();
    users.forEach((user) => {
      nameMap.set(user._id.toString(), user.name);
    });

    return nameMap;
  }
}
