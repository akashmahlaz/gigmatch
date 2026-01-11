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
import { SwipesModule } from './swipes/swipes.module';
import { GigsModule } from './gigs/gigs.module';
import { MessagesModule } from './messages/messages.module';
import { MatchesModule } from './matches/matches.module';
// import { AnalyticsModule } from './analytics/analytics.module';
// import { NotificationsModule } from './notifications/notifications.module';
// import { SubscriptionModule } from './subscription/subscription.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { EmailModule } from './email/email.module';

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
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
          },
          fcm: {
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY,
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
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: '7d',
        },
      }),
      inject: [ConfigService],
    }),

    // ═══════════════════════════════════════════════════════════════════
    // ☁️ CLOUDINARY - File uploads (images, audio, video)
    // ═══════════════════════════════════════════════════════════════════
    CloudinaryModule,

    // 📧 EMAIL - Transactional emails
    EmailModule,

    // ═══════════════════════════════════════════════════════════════════
    // 🎸 FEATURE MODULES
    // ═══════════════════════════════════════════════════════════════════
    AuthModule,
    ArtistsModule,
    VenuesModule,
    SwipesModule,
    GigsModule,
    MessagesModule,
    MatchesModule,
    // AnalyticsModule,
    // NotificationsModule,
    // SubscriptionModule,
  ],
})
export class AppModule {}
