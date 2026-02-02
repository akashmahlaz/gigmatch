/// 💰 Wallet Module - NestJS Module for Wallet & Payouts
///
/// Provides wallet, transactions, and payout functionality

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import {
  Wallet,
  WalletSchema,
  Transaction,
  TransactionSchema,
  PayoutMethod,
  PayoutMethodSchema,
  PayoutRequest,
  PayoutRequestSchema,
} from './schemas/wallet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: PayoutMethod.name, schema: PayoutMethodSchema },
      { name: PayoutRequest.name, schema: PayoutRequestSchema },
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
