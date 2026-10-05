import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { DatabaseService } from '../database/database.service';
import { PublicDemoRequestsController } from './publicDemoRequests.controller';
import { AdminDemoRequestsController } from './adminDemoRequests.controller';
import { DemoRequestsService } from './demoRequests.service';
import { DEMO_REQUEST_THROTTLER } from './demoRequestsThrottle';

// The real controllers, ThrottlerGuard, AdminScopeGuard and
// RequirePermissionsGuard; only sign-in, the database and the service are
// faked. Each user's permissions come back from the fake database.
const PERMISSIONS_BY_USER: Record<string, string[]> = {
  owner: ['ai.use', 'platform.manage'],
  orgAdmin: ['machine.manage', 'support.manage', 'audit.view'],
  technician: ['ai.use', 'machine.view'],
};

const fakeClient = (userId: string) => ({
  query: async (sql: string) => ({
    rows: sql.includes('p.code')
      ? (PERMISSIONS_BY_USER[userId] ?? []).map((code) => ({ code }))
      : [{ name: userId }],
  }),
});

// Signs in whoever the X-Test-User header names.
const fakeJwtGuard: CanActivate = {
  canActivate: (context: ExecutionContext) => {
    const httpRequest = context.switchToHttp().getRequest();
    const userId = httpRequest.headers['x-test-user'];
    if (!userId) return false;
    httpRequest.user = { userId, tenantId: 'tenant-1', email: 'x@y.z' };
    return true;
  },
};

const REQUEST_ID = '6f1c2c4e-8a8b-4d7e-9a43-2f2a1d1c0b11';
const FORM = {
  email: 'jo@acme.com',
  firstName: 'Jo',
  lastName: 'Bloggs',
  company: 'Acme',
  country: 'Australia',
  turnstileToken: 'token',
};

const service = {
  submit: jest.fn().mockResolvedValue({ success: true }),
  list: jest
    .fn()
    .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
  get: jest.fn().mockResolvedValue({ id: REQUEST_ID }),
  update: jest.fn().mockResolvedValue({ id: REQUEST_ID }),
  resendEmails: jest.fn().mockResolvedValue({ teamEmailSent: true }),
};

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([DEMO_REQUEST_THROTTLER])],
    controllers: [PublicDemoRequestsController, AdminDemoRequestsController],
    providers: [
      { provide: DemoRequestsService, useValue: service },
      {
        provide: DatabaseService,
        useValue: {
          withTenant: (_tenantId: string, work: (client: unknown) => unknown) =>
            work(fakeClient(currentUserId)),
        },
      },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(fakeJwtGuard)
    .compile();
  app = moduleRef.createNestApplication();
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

// The fake database answers for whoever the current request signs in as.
let currentUserId = '';
const asUser = (userId: string) => {
  currentUserId = userId;
  return { 'X-Test-User': userId };
};

describe('POST /public/demo-requests', () => {
  it('returns only { success: true }', async () => {
    const response = await request(app.getHttpServer())
      .post('/public/demo-requests')
      .send(FORM)
      .expect(200);
    expect(response.body).toEqual({ success: true });
  });

  it('refuses invalid input with 400 before reaching the service', async () => {
    service.submit.mockClear();
    await request(app.getHttpServer())
      .post('/public/demo-requests')
      .send({ ...FORM, email: 'not-an-email', extra: 'x' })
      .expect(400);
    expect(service.submit).not.toHaveBeenCalled();
  });

  it('allows 5 requests per IP per hour, then answers 429', async () => {
    // The two tests above already used 2 of this IP's 5.
    for (let attempt = 3; attempt <= 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/public/demo-requests')
        .send(FORM)
        .expect(200);
    }
    await request(app.getHttpServer())
      .post('/public/demo-requests')
      .send(FORM)
      .expect(429);
  });
});

describe('/admin/demo-requests', () => {
  const routes = [
    ['get', '/admin/demo-requests'],
    ['get', `/admin/demo-requests/${REQUEST_ID}`],
    ['patch', `/admin/demo-requests/${REQUEST_ID}`],
    ['post', `/admin/demo-requests/${REQUEST_ID}/resend-emails`],
  ] as const;

  it.each(routes)(
    '%s %s: 403 for an organisation admin',
    async (method, path) => {
      await request(app.getHttpServer())
        [method](path)
        .set(asUser('orgAdmin'))
        .expect(403);
    },
  );

  it.each(routes)('%s %s: 403 for a normal user', async (method, path) => {
    await request(app.getHttpServer())
      [method](path)
      .set(asUser('technician'))
      .expect(403);
  });

  it.each(routes)('%s %s: allowed for the Owner', async (method, path) => {
    const response = await request(app.getHttpServer())
      [method](path)
      .set(asUser('owner'));
    expect(response.status).toBeLessThan(300);
  });

  it('PATCH accepts status and notes only', async () => {
    await request(app.getHttpServer())
      .patch(`/admin/demo-requests/${REQUEST_ID}`)
      .set(asUser('owner'))
      .send({ status: 'contacted', email: 'changed@example.com' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/admin/demo-requests/${REQUEST_ID}`)
      .set(asUser('owner'))
      .send({ status: 'contacted', notes: 'Called Tuesday' })
      .expect(200);
  });
});
