/// 🎯 GIGMATCH NESTJS APPLICATION MODULE
///
/// Main application module that imports and configures all feature modules
/// Database: MongoDB with Mongoose ODM
/// Auth: JWT + Passport strategies

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Core Modules
import { AuthModule } from './auth/auth.module';
import { ArtistsModule } from './artists/artists.module';
import { VenuesModule } from './venues/venues.module';
import { GigsModule } from './gigs/gigs.module';
import { ChatModule } from './chat/chat.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MatchingModule } from './matching/matching.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';

@Module({
  imports: [
    // ═══════════════════════════════════════════════════════════════════
    // 📦 CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [
        () => ({
          jwt: {
            secret: process.env.JWT_SECRET || 'gigmatch-super-secret-key-2024',
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
            refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
          },
          mongodb: {
            uri:
              process.env.MONGODB_URI || 'mongodb://localhost:27017/gigmatch',
          },
          cloudinary: {
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            apiSecret: process.env.CLOUDINARY_API_SECRET,
          },
          stripe: {
            secretKey: process.env.STRIPE_SECRET_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
          },
          app: {
            port: parseInt(process.env.PORT || '3000'),
            environment: process.env.NODE_ENV || 'development',
          },
        }),
      ],
    }),

    // ═══════════════════════════════════════════════════════════════════
    // 🗄️ DATABASE - MongoDB with Mongoose
    // ═══════════════════════════════════════════════════════════════════
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.uri'),
        connectionFactory: (connection) => {
          // Enable geospatial indexing for location-based queries
          connection.plugin(require('mongoose-geojson-schema'));
          return connection;
        },
      }),
      inject: [ConfigService],
    }),

    // ═══════════════════════════════════════════════════════════════════
    // 🔐 AUTHENTICATION - JWT + Passport
    // ═══════════════════════════════════════════════════════════════════
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),

    // ═══════════════════════════════════════════════════════════════════
    // ☁️ CLOUDINARY - File uploads (images, audio, video)
    // ═══════════════════════════════════════════════════════════════════
    CloudinaryModule,

    // ═══════════════════════════════════════════════════════════════════
    // 🎸 FEATURE MODULES
    // ═══════════════════════════════════════════════════════════════════
    AuthModule,
    ArtistsModule,
    VenuesModule,
    GigsModule,
    ChatModule,
    ReviewsModule,
    PaymentsModule,
    NotificationsModule,
    MatchingModule,
  ],
})
export class AppModule {}
