/// 💰 Wallet Controller - REST API for Wallet & Payouts
///
/// Exposes wallet endpoints for the Flutter app

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PayoutMethodType } from './schemas/wallet.schema';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /// GET /wallet/balance - Get wallet balance
  @Get('balance')
  @ApiOperation({ summary: 'Get wallet balance and summary' })
  async getBalance(@Req() req: any) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const data = await this.walletService.getBalance(userId);
    return { success: true, data };
  }

  /// GET /wallet/transactions - Get transactions
  @Get('transactions')
  @ApiOperation({ summary: 'Get wallet transactions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  async getTransactions(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const data = await this.walletService.getTransactions(userId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      type,
    });
    return { success: true, ...data };
  }

  /// GET /wallet/transactions/:id - Get single transaction
  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get transaction details' })
  async getTransaction(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const data = await this.walletService.getTransaction(id, userId);
    return { success: true, data };
  }

  /// GET /wallet/payout/methods - Get payout methods
  @Get('payout/methods')
  @ApiOperation({ summary: 'Get payout methods' })
  async getPayoutMethods(@Req() req: any) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const data = await this.walletService.getPayoutMethods(userId);
    return { success: true, data };
  }

  /// POST /wallet/payout/methods/add - Add payout method
  @Post('payout/methods/add')
  @ApiOperation({ summary: 'Add a payout method' })
  async addPayoutMethod(
    @Req() req: any,
    @Body() body: {
      type: PayoutMethodType;
      displayName?: string;
      last4?: string;
      bankName?: string;
      stripeExternalAccountId?: string;
    },
  ) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const data = await this.walletService.addPayoutMethod(userId, body);
    return { success: true, data };
  }

  /// POST /wallet/payout/methods/default - Set default payout method
  @Post('payout/methods/default')
  @ApiOperation({ summary: 'Set default payout method' })
  async setDefaultPayoutMethod(
    @Req() req: any,
    @Body() body: { methodId: string },
  ) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    await this.walletService.setDefaultPayoutMethod(userId, body.methodId);
    return { success: true };
  }

  /// DELETE /wallet/payout/methods/:id - Remove payout method
  @Delete('payout/methods/:id')
  @ApiOperation({ summary: 'Remove a payout method' })
  async removePayoutMethod(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    await this.walletService.removePayoutMethod(userId, id);
    return { success: true };
  }

  /// POST /wallet/payout/request - Request payout
  @Post('payout/request')
  @ApiOperation({ summary: 'Request a payout' })
  async requestPayout(
    @Req() req: any,
    @Body() body: { amount: number; payoutMethodId?: string },
  ) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const data = await this.walletService.requestPayout(
      userId,
      body.amount,
      body.payoutMethodId,
    );
    return { success: true, data };
  }

  /// GET /wallet/payout/history - Get payout history
  @Get('payout/history')
  @ApiOperation({ summary: 'Get payout history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPayoutHistory(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const data = await this.walletService.getPayoutHistory(userId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { success: true, ...data };
  }

  /// GET /wallet/stripe/onboarding - Get Stripe Connect onboarding link
  @Get('stripe/onboarding')
  @ApiOperation({ summary: 'Get Stripe Connect onboarding link' })
  @ApiQuery({ name: 'returnUrl', required: true, type: String })
  async getStripeOnboarding(
    @Req() req: any,
    @Query('returnUrl') returnUrl: string,
  ) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const url = await this.walletService.getStripeOnboardingLink(userId, returnUrl);
    return { success: true, url };
  }

  /// GET /wallet/stripe/dashboard - Get Stripe dashboard link
  @Get('stripe/dashboard')
  @ApiOperation({ summary: 'Get Stripe dashboard link' })
  async getStripeDashboard(@Req() req: any) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const url = await this.walletService.getStripeDashboardLink(userId);
    return { success: true, url };
  }
}
