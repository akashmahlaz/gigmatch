/// 💰 Wallet Service - Business Logic for Wallet & Payouts
///
/// Manages wallet balances, transactions, and Stripe Connect integration

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  Wallet,
  WalletDocument,
  Transaction,
  TransactionDocument,
  PayoutMethod,
  PayoutMethodDocument,
  PayoutRequest,
  PayoutRequestDocument,
  TransactionType,
  TransactionStatus,
  PayoutStatus,
  PayoutMethodType,
} from './schemas/wallet.schema';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private stripe: Stripe;

  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(PayoutMethod.name) private payoutMethodModel: Model<PayoutMethodDocument>,
    @InjectModel(PayoutRequest.name) private payoutRequestModel: Model<PayoutRequestDocument>,
    private configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('stripe.secretKey');
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });
    }
  }

  /// Get or create wallet for user
  async getOrCreateWallet(userId: string): Promise<WalletDocument> {
    let wallet = await this.walletModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
    
    if (!wallet) {
      wallet = new this.walletModel({
        userId: new Types.ObjectId(userId),
        availableBalance: 0,
        pendingBalance: 0,
        totalEarnings: 0,
        totalPaidOut: 0,
        currency: 'USD',
      });
      await wallet.save();
      this.logger.log(`Created wallet for user ${userId}`);
    }
    
    return wallet;
  }

  /// Get wallet balance
  async getBalance(userId: string): Promise<{
    availableBalance: number;
    pendingBalance: number;
    totalEarnings: number;
    totalPaidOut: number;
    currency: string;
  }> {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      availableBalance: wallet.availableBalance,
      pendingBalance: wallet.pendingBalance,
      totalEarnings: wallet.totalEarnings,
      totalPaidOut: wallet.totalPaidOut,
      currency: wallet.currency,
    };
  }

  /// Get transactions with pagination and filters
  async getTransactions(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      type?: string;
      status?: string;
    } = {},
  ): Promise<{
    transactions: TransactionDocument[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const { page = 1, limit = 20, type, status } = options;
    const skip = (page - 1) * limit;

    const query: any = { userId: new Types.ObjectId(userId) };
    if (type) {
      query.type = type;
    }
    if (status) {
      query.status = status;
    }

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.transactionModel.countDocuments(query),
    ]);

    return {
      transactions,
      total,
      page,
      limit,
      hasMore: skip + transactions.length < total,
    };
  }

  /// Get single transaction
  async getTransaction(transactionId: string, userId: string): Promise<TransactionDocument> {
    const transaction = await this.transactionModel.findOne({
      _id: new Types.ObjectId(transactionId),
      userId: new Types.ObjectId(userId),
    }).exec();

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  /// Get payout methods
  async getPayoutMethods(userId: string): Promise<PayoutMethodDocument[]> {
    return this.payoutMethodModel
      .find({ userId: new Types.ObjectId(userId), isActive: true })
      .sort({ isDefault: -1, createdAt: -1 })
      .exec();
  }

  /// Add payout method
  async addPayoutMethod(
    userId: string,
    data: {
      type: PayoutMethodType;
      displayName?: string;
      last4?: string;
      bankName?: string;
      stripeExternalAccountId?: string;
    },
  ): Promise<PayoutMethodDocument> {
    // Check if this is the first method - make it default
    const existingMethods = await this.payoutMethodModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isActive: true,
    });

    const method = new this.payoutMethodModel({
      userId: new Types.ObjectId(userId),
      type: data.type,
      displayName: data.displayName,
      last4: data.last4,
      bankName: data.bankName,
      stripeExternalAccountId: data.stripeExternalAccountId,
      isDefault: existingMethods === 0,
      isActive: true,
    });

    await method.save();
    return method;
  }

  /// Set default payout method
  async setDefaultPayoutMethod(userId: string, methodId: string): Promise<void> {
    // Unset all other defaults
    await this.payoutMethodModel.updateMany(
      { userId: new Types.ObjectId(userId) },
      { isDefault: false },
    );

    // Set new default
    await this.payoutMethodModel.updateOne(
      { _id: new Types.ObjectId(methodId), userId: new Types.ObjectId(userId) },
      { isDefault: true },
    );
  }

  /// Remove payout method
  async removePayoutMethod(userId: string, methodId: string): Promise<void> {
    const result = await this.payoutMethodModel.updateOne(
      { _id: new Types.ObjectId(methodId), userId: new Types.ObjectId(userId) },
      { isActive: false },
    );

    if (result.modifiedCount === 0) {
      throw new NotFoundException('Payout method not found');
    }
  }

  /// Request payout
  async requestPayout(
    userId: string,
    amount: number,
    payoutMethodId?: string,
  ): Promise<PayoutRequestDocument> {
    const wallet = await this.getOrCreateWallet(userId);

    if (amount <= 0) {
      throw new BadRequestException('Payout amount must be positive');
    }

    if (amount > wallet.availableBalance) {
      throw new BadRequestException('Insufficient balance');
    }

    // Get payout method
    let method: PayoutMethodDocument | null = null;
    if (payoutMethodId) {
      method = await this.payoutMethodModel.findOne({
        _id: new Types.ObjectId(payoutMethodId),
        userId: new Types.ObjectId(userId),
        isActive: true,
      }).exec();
    } else {
      // Get default method
      method = await this.payoutMethodModel.findOne({
        userId: new Types.ObjectId(userId),
        isDefault: true,
        isActive: true,
      }).exec();
    }

    if (!method) {
      throw new BadRequestException('No payout method available');
    }

    // Create payout request
    const payoutRequest = new this.payoutRequestModel({
      userId: new Types.ObjectId(userId),
      amount,
      currency: wallet.currency,
      status: PayoutStatus.PENDING,
      payoutMethodId: method._id,
    });

    await payoutRequest.save();

    // Deduct from available balance, add to pending (for processing)
    wallet.availableBalance -= amount;
    await wallet.save();

    // Create transaction record
    const transaction = new this.transactionModel({
      userId: new Types.ObjectId(userId),
      type: TransactionType.PAYOUT,
      amount: -amount,
      currency: wallet.currency,
      status: TransactionStatus.PENDING,
      description: `Payout request - ${method.displayName || method.type}`,
    });
    await transaction.save();

    this.logger.log(`Payout requested: $${amount} for user ${userId}`);
    return payoutRequest;
  }

  /// Get payout history
  async getPayoutHistory(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{
    payouts: PayoutRequestDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [payouts, total] = await Promise.all([
      this.payoutRequestModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.payoutRequestModel.countDocuments({ userId: new Types.ObjectId(userId) }),
    ]);

    return { payouts, total, page, limit };
  }

  /// Add earning to wallet (called when booking is completed)
  async addEarning(
    userId: string,
    amount: number,
    description: string,
    bookingId?: string,
    gigId?: string,
  ): Promise<TransactionDocument> {
    const wallet = await this.getOrCreateWallet(userId);

    // Add to available balance and total earnings
    wallet.availableBalance += amount;
    wallet.totalEarnings += amount;
    await wallet.save();

    // Create transaction
    const transaction = new this.transactionModel({
      userId: new Types.ObjectId(userId),
      type: TransactionType.EARNING,
      amount,
      currency: wallet.currency,
      status: TransactionStatus.COMPLETED,
      description,
      bookingId: bookingId ? new Types.ObjectId(bookingId) : undefined,
      gigId: gigId ? new Types.ObjectId(gigId) : undefined,
    });

    await transaction.save();
    this.logger.log(`Earning added: $${amount} for user ${userId}`);
    return transaction;
  }

  /// Get Stripe Connect onboarding link
  async getStripeOnboardingLink(userId: string, returnUrl: string): Promise<string> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    const wallet = await this.getOrCreateWallet(userId);

    // Create or retrieve Stripe Connect account
    if (!wallet.stripeConnectAccountId) {
      const account = await this.stripe.accounts.create({
        type: 'express',
        capabilities: {
          transfers: { requested: true },
        },
      });

      wallet.stripeConnectAccountId = account.id;
      await wallet.save();
    }

    // Create account link for onboarding
    const accountLink = await this.stripe.accountLinks.create({
      account: wallet.stripeConnectAccountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return accountLink.url;
  }

  /// Get Stripe dashboard link
  async getStripeDashboardLink(userId: string): Promise<string> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    const wallet = await this.getOrCreateWallet(userId);

    if (!wallet.stripeConnectAccountId) {
      throw new BadRequestException('Stripe Connect account not set up');
    }

    const loginLink = await this.stripe.accounts.createLoginLink(wallet.stripeConnectAccountId);
    return loginLink.url;
  }
}
