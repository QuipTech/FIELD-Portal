import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as Stripe from 'stripe';
import { StripeService } from '../stripe/stripe.service';
import { StripeWebhookController } from './stripeWebhook.controller';
import { StripeWebhookService } from './stripeWebhook.service';

// The real controller and signature check (Stripe SDK), over HTTP with the
// raw body enabled as in main.ts. Only the event handling is stubbed.
const WEBHOOK_SECRET = 'whsec_test_secret';
const payload = JSON.stringify({
  id: 'evt_1',
  object: 'event',
  type: 'invoice.paid',
  data: { object: {} },
});

const handleEvent = jest.fn().mockResolvedValue({ status: 'processed' });
let app: INestApplication;

const signedHeader = (secret: string) =>
  new Stripe('sk_test_signing').webhooks.generateTestHeaderString({
    payload,
    secret,
  });

beforeAll(async () => {
  const settings: Record<string, string> = {
    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    NODE_ENV: 'test',
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [StripeWebhookController],
    providers: [
      StripeService,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => settings[key] },
      },
      { provide: StripeWebhookService, useValue: { handleEvent } },
    ],
  }).compile();
  app = moduleRef.createNestApplication({ rawBody: true });
  await app.init();
});

afterAll(() => app.close());
beforeEach(() => handleEvent.mockClear());

const post = (signature?: string) => {
  const call = request(app.getHttpServer())
    .post('/webhooks/stripe')
    .set('Content-Type', 'application/json');
  if (signature) call.set('Stripe-Signature', signature);
  return call.send(payload);
};

describe('POST /webhooks/stripe', () => {
  it('returns 400 for a signature made with the wrong secret', async () => {
    await post(signedHeader('whsec_wrong')).expect(400);
    expect(handleEvent).not.toHaveBeenCalled();
  });

  it('returns 400 when the signature header is missing', async () => {
    await post().expect(400);
    expect(handleEvent).not.toHaveBeenCalled();
  });

  it('accepts a correctly signed event and hands it on', async () => {
    await post(signedHeader(WEBHOOK_SECRET)).expect(200, {
      status: 'processed',
    });
    expect(handleEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt_1', type: 'invoice.paid' }),
    );
  });
});
