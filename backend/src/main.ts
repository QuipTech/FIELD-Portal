import { NestFactory } from '@nestjs/core';
import { NextFunction, Request, Response, json } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getPortalOrigins } from './common/security/portalOrigins';
import { PortalIoAdapter } from './common/security/portalIoAdapter';

async function bootstrap() {
  // rawBody: the Stripe webhook verifies its signature against the exact
  // bytes received (request.rawBody); parsed JSON bodies work as before.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Questions to the AI assistant may carry a base64 photo; every other
  // JSON body keeps the default 100 KB limit. Registered before Nest's
  // own parser, which then skips the already-parsed body. The wrapper
  // matters: Nest skips its global parser entirely if it finds a
  // middleware named `jsonParser` (express.json's function name).
  const photoJsonParser = json({ limit: '6mb' });
  app.use(
    '/ai/ask',
    (request: Request, response: Response, next: NextFunction) =>
      photoJsonParser(request, response, next),
  );
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
