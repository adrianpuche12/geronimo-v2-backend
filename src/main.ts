import 'dotenv/config'; // IMPORTANTE: Cargar .env ANTES de cualquier otra cosa
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    bodyParser: false, // Deshabilitar el body parser por defecto
  });

  // Configurar body parser con límite de 10MB
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3006', 'http://62.171.160.238:3006'],
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Geronimo 2.0 API')
    .setDescription('Multi-tenant AI-powered documentation assistant')
    .setVersion('2.0')
    .addTag('Projects', 'Project management endpoints')
    .addTag('Documents', 'Document management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3005;
  await app.listen(port, '0.0.0.0'); // Listen on all interfaces

  console.log('='.repeat(60));
  console.log('🚀 Geronimo V2 Backend - NestJS + Clean Architecture');
  console.log('📍 Environment:', process.env.NODE_ENV || 'development');
  console.log('🌐 Server:', `http://62.171.160.238:${port}`);
  console.log('📚 API Docs:', `http://62.171.160.238:${port}/api/docs`);
  console.log('🗄️  NeonDB:', process.env.DB_HOST);
  console.log('⚡ Redis:', process.env.REDIS_HOST);
  console.log('☁️  B2 Storage:', process.env.B2_ENABLED === 'true' ? 'Enabled' : 'Disabled');
  console.log('📦 Max File Size: 10MB');
  console.log('='.repeat(60));
}

bootstrap();
