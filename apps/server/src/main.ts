import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Prisma exception filter
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS configuration
  const configService = app.get(ConfigService);
  const corsOrigins = configService.get('CORS_ORIGINS', 'http://localhost:4000');
  app.enableCors({
    origin: corsOrigins.split(',').map((s: string) => s.trim()),
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api');

  const port = configService.get('PORT', 4001);

  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
}

bootstrap();
