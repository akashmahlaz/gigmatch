import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';
import { Artist, ArtistDocument } from '../artists/schemas/artist.schema';
import { Venue, VenueDocument } from '../venues/schemas/venue.schema';
import { Match, MatchDocument } from '../schemas/match.schema';
import { Subscription, SubscriptionDocument } from '../schemas/subscription.schema';
import { CreateUserDto, UpdateUserDto, QueryUsersDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Artist.name) private artistModel: Model<ArtistDocument>,
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  // Dashboard Statistics
  async getDashboardStats() {
    const [
      totalUsers,
      totalArtists,
      totalVenues,
      totalMatches,
      activeSubscriptions,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.artistModel.countDocuments(),
      this.venueModel.countDocuments(),
      this.matchModel.countDocuments({ status: 'active' }),
      this.subscriptionModel.countDocuments({
        status: 'active',
        plan: { $ne: 'free' },
      }),
    ]);

    // Get recent users for dashboard
    const recentUsersRaw = await this.userModel
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('fullName email role photo createdAt')
      .lean();

    // Transform recent users
    const recentUsers = recentUsersRaw.map((user: any) => ({
      ...user,
      id: user._id.toString(),
    }));

    // Calculate growth (mock for now - you can add proper logic)
    const userGrowth = 12.5;
    const matchRate = 68;

    return {
      stats: {
        totalUsers,
        totalArtists,
        totalVenues,
        totalMatches,
        activeSubscriptions,
        monthlyRevenue: activeSubscriptions * 29.99, // Mock calculation
        userGrowth,
        matchRate,
      },
      recentUsers,
    };
  }

  // User Management
  async getUsers(query: QueryUsersDto) {
    const { page = 1, limit = 20, role, status, search } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (role) filter.role = role;
    if (status === 'active') filter.isActive = true;
    if (status === 'banned') filter.isBanned = true;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('artistProfile', 'displayName genres')
        .populate('venueProfile', 'venueName venueType')
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    // Transform _id to id for frontend
    const transformedUsers = users.map((user: any) => ({
      ...user,
      id: user._id.toString(),
      status: user.isBanned ? 'banned' : user.isActive ? 'active' : 'inactive',
    }));

    return {
      users: transformedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(id: string) {
    const user: any = await this.userModel
      .findById(id)
      .select('-password')
      .populate('artistProfile')
      .populate('venueProfile')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      id: user._id.toString(),
      status: user.isBanned ? 'banned' : user.isActive ? 'active' : 'inactive',
    };
  }

  async createUser(createUserDto: CreateUserDto) {
    // Check if user exists
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email,
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

    // Create user
    const user = await this.userModel.create({
      ...createUserDto,
      password: hashedPassword,
      isEmailVerified: true, // Admin-created users are auto-verified
      isActive: true,
    });

    // Create profile if artist or venue
    if (createUserDto.role === 'artist') {
      const artist = await this.artistModel.create({
        userId: user._id,
        displayName: createUserDto.fullName,
        location: { city: 'Not Set', country: 'Not Set', travelRadiusMiles: 50 },
      });
      user.artistProfile = artist._id;
      await user.save();
    } else if (createUserDto.role === 'venue') {
      const venue = await this.venueModel.create({
        userId: user._id,
        venueName: createUserDto.fullName,
        venueType: 'bar',
        location: { city: 'Not Set', country: 'Not Set' },
      });
      user.venueProfile = venue._id;
      await user.save();
    }

    return this.userModel
      .findById(user._id)
      .select('-password')
      .lean();
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If updating password, hash it
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 12);
    }

    Object.assign(user, updateUserDto);
    await user.save();

    return this.userModel
      .findById(id)
      .select('-password')
      .lean();
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete associated profiles
    if (user.artistProfile) {
      await this.artistModel.findByIdAndDelete(user.artistProfile);
    }
    if (user.venueProfile) {
      await this.venueModel.findByIdAndDelete(user.venueProfile);
    }

    // Delete user
    await user.deleteOne();
  }

  async banUser(id: string) {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isBanned = true;
    user.isActive = false;
    await user.save();

    return { message: 'User banned successfully' };
  }

  async unbanUser(id: string) {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isBanned = false;
    user.isActive = true;
    await user.save();

    return { message: 'User unbanned successfully' };
  }

  // Artist Management
  async getArtists(query: any) {
    const { page = 1, limit = 20, genre, verified, search } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (genre) filter.genres = genre;
    if (verified === 'true') filter.isVerified = true;
    if (search) {
      filter.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
      ];
    }

    const [artists, total] = await Promise.all([
      this.artistModel
        .find(filter)
        .populate('user', 'fullName email isActive')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.artistModel.countDocuments(filter),
    ]);

    // Transform _id to id
    const transformedArtists = artists.map((artist: any) => ({
      ...artist,
      id: artist._id.toString(),
    }));

    return {
      artists: transformedArtists,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateArtist(id: string, data: any) {
    const artist = await this.artistModel.findByIdAndUpdate(id, data, {
      new: true,
    });

    if (!artist) {
      throw new NotFoundException('Artist not found');
    }

    return artist;
  }

  async deleteArtist(id: string) {
    const artist = await this.artistModel.findById(id);

    if (!artist) {
      throw new NotFoundException('Artist not found');
    }

    // Delete associated user
    if (artist.userId) {
      await this.userModel.findByIdAndDelete(artist.userId);
    }

    await artist.deleteOne();
  }

  // Venue Management
  async getVenues(query: any) {
    const { page = 1, limit = 20, type, verified, search } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (type) filter.venueType = type;
    if (verified === 'true') filter.isVerified = true;
    if (search) {
      filter.$or = [
        { venueName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [venues, total] = await Promise.all([
      this.venueModel
        .find(filter)
        .populate('user', 'fullName email isActive')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.venueModel.countDocuments(filter),
    ]);

    // Transform _id to id
    const transformedVenues = venues.map((venue: any) => ({
      ...venue,
      id: venue._id.toString(),
    }));

    return {
      venues: transformedVenues,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateVenue(id: string, data: any) {
    const venue = await this.venueModel.findByIdAndUpdate(id, data, {
      new: true,
    });

    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    return venue;
  }

  async deleteVenue(id: string) {
    const venue = await this.venueModel.findById(id);

    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    // Delete associated user
    if (venue.userId) {
      await this.userModel.findByIdAndDelete(venue.userId);
    }

    await venue.deleteOne();
  }

  // Matches
  async getMatches(query: any) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [matches, total] = await Promise.all([
      this.matchModel
        .find()
        .populate('artist', 'displayName')
        .populate('venue', 'venueName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.matchModel.countDocuments(),
    ]);

    return {
      matches,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Reports
  async getReports(query: any) {
    // Mock reports data - implement actual analytics
    return {
      userGrowth: [],
      revenueGrowth: [],
      matchingStats: [],
      topArtists: [],
      topVenues: [],
    };
  }

  // Subscriptions
  async getSubscriptions(query: any) {
    const { page = 1, limit = 20, plan, status } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (plan) filter.plan = plan;
    if (status) filter.status = status;

    const [subscriptions, total] = await Promise.all([
      this.subscriptionModel
        .find(filter)
        .populate('user', 'fullName email')
        .populate('artist', 'displayName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.subscriptionModel.countDocuments(filter),
    ]);

    return {
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ⚠️ DANGER ZONE - Reset Database (Development Only)
  async resetDatabase() {
    console.log('🚨 ========================================');
    console.log('🚨 RESETTING DATABASE - DELETING ALL DATA');
    console.log('🚨 ========================================');

    const startTime = Date.now();

    try {
      // Delete all users and related data
      const [
        deletedUsers,
        deletedArtists,
        deletedVenues,
        deletedMatches,
        deletedSubscriptions,
      ] = await Promise.all([
        this.userModel.deleteMany({}),
        this.artistModel.deleteMany({}),
        this.venueModel.deleteMany({}),
        this.matchModel.deleteMany({}),
        this.subscriptionModel.deleteMany({}),
      ]);

      const elapsed = Date.now() - startTime;

      const result = {
        success: true,
        message: '✅ Database reset complete',
        deleted: {
          users: deletedUsers.deletedCount,
          artists: deletedArtists.deletedCount,
          venues: deletedVenues.deletedCount,
          matches: deletedMatches.deletedCount,
          subscriptions: deletedSubscriptions.deletedCount,
        },
        elapsed: `${elapsed}ms`,
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Database reset complete:', result);
      return result;
    } catch (error) {
      console.error('❌ Database reset failed:', error);
      throw new BadRequestException('Failed to reset database');
    }
  }
}
