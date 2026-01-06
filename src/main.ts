import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  // Enable CORS - Allow all origins in development, specific origins in production
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'https://roxxie.vercel.app',
    'https://gigmatch-web.vercel.app',
  ];
  
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? allowedOrigins 
      : true, // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    credentials: true,
  });

  // Global validation pipe with latest options
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('GigMatch API')
    .setDescription('Music Gig Matching Platform - Connect Artists with Venues')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication & Authorization')
    .addTag('users', 'User Management')
    .addTag('artists', 'Artist Profiles & Discovery')
    .addTag('venues', 'Venue Profiles & Management')
    .addTag('gigs', 'Gig Postings')
    .addTag('swipes', 'Swipe & Matching System')
    .addTag('messages', 'Real-time Chat')
    .addTag('bookings', 'Booking Management')
    .addTag('reviews', 'Reviews & Ratings')
    .addTag('subscriptions', 'Premium Subscriptions')
    .addTag('admin', 'Admin Operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`
  🎸 GIGMATCH API Server Running!
  ────────────────────────────────
  📡 Server:     http://localhost:${port}
  📚 API Docs:   http://localhost:${port}/api/docs
  🔌 WebSocket:  ws://localhost:${port}
  ────────────────────────────────
  `);
}
bootstrap();
