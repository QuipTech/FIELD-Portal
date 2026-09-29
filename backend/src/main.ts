import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: the Stripe webhook verifies its signature against the exact
  // bytes received (request.rawBody); parsed JSON bodies work as before.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    // Comma-separated, so local dev can allow both portal ports at once.
    origin: (process.env.PORTAL_ORIGIN ?? 'http://localhost:3001').split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
