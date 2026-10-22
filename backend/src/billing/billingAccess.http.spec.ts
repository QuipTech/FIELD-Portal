import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { DatabaseService } from '../database/database.service';
import { BillingAccountsController } from './billingAccounts/billingAccounts.controller';
import { BillingAccountsService } from './billingAccounts/billingAccounts.service';
import { InvoicesController } from './invoices/invoices.controller';
import { InvoicesService } from './invoices/invoices.service';

// The real controllers and permission guard; sign-in, the permission
// lookup and the services are faked. Only platform.manage gets through.
const PERMISSIONS_BY_USER: Record<string, string[]> = {
  'platform-admin': ['platform.manage', 'users.manage'],
  'org-owner': ['users.manage', 'support.create'],
  customer: ['support.create'],
};

const fakeJwtGuard: CanActivate = {
  canActivate: (context: ExecutionContext) => {
    const httpRequest = context.switchToHttp().getRequest();
    const userId = httpRequest.headers['x-test-user'] as string;
    if (!PERMISSIONS_BY_USER[userId]) return false;
    httpRequest.user = { userId, tenantId: 'tenant-a', email: 'x@y.z' };
    return true;
  },
};

const fakeDatabase = {
  withTenant: async (_tenantId: string, work: (client: unknown) => unknown) =>
    work({
      query: async (_sql: string, params: string[]) => ({
        rows: (PERMISSIONS_BY_USER[params[0]] ?? []).map((code) => ({ code })),
      }),
    }),
};

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [BillingAccountsController, InvoicesController],
    providers: [
      RequirePermissionsGuard,
      { provide: DatabaseService, useValue: fakeDatabase },
      {
        provide: BillingAccountsService,
        useValue: { listOrganisations: async () => [] },
      },
      { provide: InvoicesService, useValue: {} },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(fakeJwtGuard)
    .compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
});

afterAll(() => app.close());

const ADMIN_ROUTES: [string, string][] = [
  ['get', '/admin/billing/organisations'],
  ['post', '/admin/billing/accounts'],
  ['post', '/admin/billing/test-invoices'],
  ['get', '/admin/billing/invoices'],
  ['get', '/admin/billing/invoices/11111111-1111-4111-8111-111111111111'],
];

describe('billing admin routes', () => {
  it.each(
    ADMIN_ROUTES.flatMap(([method, path]) =>
      ['org-owner', 'customer'].map((user) => [user, method, path] as const),
    ),
  )('%s gets 403 on %s %s', async (user, method, path) => {
    const call =
      method === 'get'
        ? request(app.getHttpServer()).get(path)
        : request(app.getHttpServer()).post(path);
    await call.set('X-Test-User', user).send({}).expect(403);
  });

  it('lets the platform administrator in', async () => {
    await request(app.getHttpServer())
      .get('/admin/billing/organisations')
      .set('X-Test-User', 'platform-admin')
      .expect(200, []);
  });
});
