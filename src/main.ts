import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  // Enable CORS - Always allow localhost for development + configured origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'https://roxxie.vercel.app',
    'https://gigmatch-web.vercel.app',
    ...(process.env.CORS_ORIGINS?.split(',') || []),
  ];
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      // Allow if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Allow any localhost origin for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      
      // Block other origins
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
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
