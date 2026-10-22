import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { PersonalSubscriptionController } from './personalSubscription.controller';
import { PersonalSubscriptionService } from './personalSubscription.service';
import { PersonalInvoiceService } from './personalInvoice.service';

const actor = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  email: 'a@example.com',
};
const payments = {
  createPayment: jest
    .fn()
    .mockResolvedValue({ paymentUrl: 'https://invoice.stripe.com/i/a' }),
};
const billing = {
  getStatus: jest.fn().mockResolvedValue({ paymentRequired: true }),
  listInvoices: jest.fn().mockResolvedValue([]),
};
const fakeAuth: CanActivate = {
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    if (req.headers.authorization !== 'Bearer test-user-a') return false;
    req.user = actor;
    return true;
  },
};
let app: INestApplication;
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [PersonalSubscriptionController],
    providers: [
      { provide: PersonalSubscriptionService, useValue: billing },
      { provide: PersonalInvoiceService, useValue: payments },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(fakeAuth)
    .compile();
  app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
});
afterAll(() => app.close());
beforeEach(() => jest.clearAllMocks());

const address = {
  line1: '1 Example St',
  city: 'Brisbane',
  state: 'QLD',
  postalCode: '4000',
};
describe('personal billing API access', () => {
  it.each(['/me/billing', '/me/billing/invoices'])(
    'refuses anonymous access to %s',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(403);
    },
  );

  it('uses the authenticated user when listing invoices', async () => {
    await request(app.getHttpServer())
      .get('/me/billing/invoices')
      .set('Authorization', 'Bearer test-user-a')
      .expect(200, []);
    expect(billing.listInvoices).toHaveBeenCalledWith(actor);
  });

  it('accepts a valid Australian address and never takes a user id from the client', async () => {
    await request(app.getHttpServer())
      .post('/me/billing/payment')
      .set('Authorization', 'Bearer test-user-a')
      .send(address)
      .expect(201);
    expect(payments.createPayment).toHaveBeenCalledWith(actor, address);
  });

  it.each([
    { userId: 'user-b' },
    { tenantId: 'tenant-b' },
    { amountCents: 1 },
    { roles: ['Owner'] },
  ])(
    'rejects caller-controlled billing identity or amounts: %j',
    async (override) => {
      await request(app.getHttpServer())
        .post('/me/billing/payment')
        .set('Authorization', 'Bearer test-user-a')
        .send({ ...address, ...override })
        .expect(400);
      expect(payments.createPayment).not.toHaveBeenCalled();
    },
  );

  it.each([
    { state: 'unknown' },
    { postalCode: 'ABC' },
    { line1: '' },
    { city: '' },
  ])('validates the billing address: %j', async (override) => {
    await request(app.getHttpServer())
      .post('/me/billing/payment')
      .set('Authorization', 'Bearer test-user-a')
      .send({ ...address, ...override })
      .expect(400);
    expect(payments.createPayment).not.toHaveBeenCalled();
  });
});
