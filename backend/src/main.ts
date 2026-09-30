import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getPortalOrigins } from './common/security/portalOrigins';
import { PortalIoAdapter } from './common/security/portalIoAdapter';

async function bootstrap() {
  // rawBody: the Stripe webhook verifies its signature against the exact
  // bytes received (request.rawBody); parsed JSON bodies work as before.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({ origin: getPortalOrigins(), credentials: true });
  app.useWebSocketAdapter(new PortalIoAdapter(app));
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
