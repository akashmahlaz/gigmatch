/// 💳 Subscription Guard
///
/// Guard for enforcing subscription tier requirements on endpoints
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../../schemas/user.schema';
import { SUBSCRIPTION_GUARD_KEY } from '../decorators/subscription.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredTier = this.reflector.get<string | undefined>(
      SUBSCRIPTION_GUARD_KEY,
      context.getHandler(),
    );

    if (!requiredTier) {
      return true; // No subscription requirement
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?._id;

    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.userModel.findById(
      new Types.ObjectId(userId.toString()),
    );

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const userTier = user.subscriptionTier || 'free';

    // Tier hierarchy: free < pro < premium
    const tierOrder = { free: 0, pro: 1, premium: 2 };
    const userTierLevel = tierOrder[userTier as keyof typeof tierOrder] || 0;
    const requiredTierLevel =
      tierOrder[requiredTier as keyof typeof tierOrder] || 0;

    if (userTierLevel < requiredTierLevel) {
      throw new ForbiddenException(
        `This feature requires ${requiredTier} subscription. Please upgrade to access.`,
      );
    }

    return true;
  }
}
