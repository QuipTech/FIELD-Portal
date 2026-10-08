import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';
import { StorageService } from '../storage/storage.service';
import { StorageBucket } from '../storage/storageBucket';
import { DashboardConfig } from '../dashboard/dashboardConfig';
import { SupportCasesController } from './supportCases.controller';
import { AdminSupportCasesController } from './adminSupportCases.controller';
import { SupportCasesService } from './supportCases.service';
import { CaseMessagesService } from './caseMessages.service';
import { AdminSupportCasesService } from './adminSupportCases.service';
import { AdminCaseUpdatesService } from './adminCaseUpdates.service';
import { CaseAccessService } from './caseAccess.service';
import { CaseAttachmentsService } from './caseAttachments.service';
import { CaseAnnouncer } from './caseAnnouncer.service';
import { CaseEmailNotifier } from './caseEmailNotifier.service';
import { CaseEventsPublisher } from './caseEventsPublisher';
import { SupportStaffGuard } from './supportStaff.guard';
import {
  ASSIGNABLE_STAFF_ID,
  createFakeDatabase,
  TEST_USERS,
} from './supportCasesFakeDatabase';

// The real controllers, guards, access checks and services; only sign-in
// and the database are faked. Case #1042 belongs to tenant-a and is
// assigned to staff-1.
const fakeDatabase = createFakeDatabase();

// Signs in whoever the X-Test-User header names.
const fakeJwtGuard: CanActivate = {
  canActivate: (context: ExecutionContext) => {
    const httpRequest = context.switchToHttp().getRequest();
    const userId = httpRequest.headers['x-test-user'] as string;
    const user = TEST_USERS[userId];
    if (!user) return false;
    httpRequest.user = { userId, tenantId: user.tenantId, email: 'x@y.z' };
    return true;
  },
};

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [SupportCasesController, AdminSupportCasesController],
    providers: [
      SupportCasesService,
      CaseMessagesService,
      AdminSupportCasesService,
      AdminCaseUpdatesService,
      CaseAccessService,
      CaseAttachmentsService,
      CaseAnnouncer,
      CaseEmailNotifier,
      CaseEventsPublisher,
      SupportStaffGuard,
      DashboardConfig,
      { provide: DatabaseService, useValue: fakeDatabase.databaseService },
      { provide: ConfigService, useValue: { get: () => undefined } },
      { provide: EmailService, useValue: { isConfigured: false } },
      { provide: StorageService, useValue: {} },
      { provide: StorageBucket, useValue: { isConfigured: () => false } },
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
beforeEach(() => fakeDatabase.reset());

const as = (userId: string) => ({ 'X-Test-User': userId });
const http = () => request(app.getHttpServer());

describe("a customer can't read another company's case", () => {
  it('finds it for its own company', async () => {
    const response = await http()
      .get('/cases/1042')
      .set(as('customer-a'))
      .expect(200);
    expect(response.body.caseNumber).toBe(1042);
  });

  it('answers 404 to another company, on every customer route', async () => {
    await http().get('/cases/1042').set(as('customer-b')).expect(404);
    await http().get('/cases/1042/messages').set(as('customer-b')).expect(404);
    await http().get('/cases/1042/events').set(as('customer-b')).expect(404);
    await http()
      .post('/cases/1042/messages')
      .set(as('customer-b'))
      .send({ body: 'hello' })
      .expect(404);
  });

  it('keeps customers out of the staff routes altogether', async () => {
    await http().get('/admin/cases/1042').set(as('customer-a')).expect(403);
    await http().get('/admin/cases').set(as('customer-a')).expect(403);
  });
});

describe('a customer never receives internal notes', () => {
  it('asks for the thread without internal notes, and gets none', async () => {
    const response = await http()
      .get('/cases/1042/messages')
      .set(as('customer-a'))
      .expect(200);
    expect(fakeDatabase.state.messageQueries).toEqual([
      { includeInternal: false },
    ]);
    expect(
      response.body.some(
        (message: { isInternal: boolean }) => message.isInternal,
      ),
    ).toBe(false);
  });

  it("can't read them through the staff route either", async () => {
    await http()
      .get('/admin/cases/1042/messages')
      .set(as('customer-a'))
      .expect(403);
  });

  it('shows them to the assignee', async () => {
    const response = await http()
      .get('/admin/cases/1042/messages')
      .set(as('staff-1'))
      .expect(200);
    expect(
      response.body.some(
        (message: { isInternal: boolean }) => message.isInternal,
      ),
    ).toBe(true);
  });

  it("refuses a customer's attempt to post one", async () => {
    await http()
      .post('/cases/1042/messages')
      .set(as('customer-a'))
      .send({ body: 'psst', isInternal: true })
      .expect(400);
  });
});

describe('only an admin or the assignee can change status', () => {
  const setStatus = (userId: string) =>
    http()
      .patch('/admin/cases/1042')
      .set(as(userId))
      .send({ status: 'waiting_on_customer' });

  it('lets the assignee and the admin change it', async () => {
    await setStatus('staff-1').expect(200);
    await setStatus('admin-1').expect(200);
    expect(fakeDatabase.state.updates).toHaveLength(2);
  });

  it('refuses another support agent (404) and a customer (403)', async () => {
    await setStatus('staff-2').expect(404);
    await setStatus('customer-a').expect(403);
    expect(fakeDatabase.state.updates).toHaveLength(0);
  });

  it('has no customer route that changes status', async () => {
    await http()
      .patch('/cases/1042')
      .set(as('customer-a'))
      .send({ status: 'closed' })
      .expect(404);
  });

  it("refuses the assignee's attempt to reassign or reprioritise", async () => {
    await http()
      .patch('/admin/cases/1042')
      .set(as('staff-1'))
      .send({ priority: 'P3' })
      .expect(403);
    expect(fakeDatabase.state.updates).toHaveLength(0);
  });
});

describe('assigning a case', () => {
  const assign = (assigneeId: string) =>
    http().patch('/admin/cases/1042').set(as('admin-1')).send({ assigneeId });

  it('sets a new case to open', async () => {
    fakeDatabase.reset({ status: 'new', assignee_id: null });
    await assign(ASSIGNABLE_STAFF_ID).expect(200);
    expect(fakeDatabase.state.updates).toEqual([
      ['tenant-a', 'case-1', 'open', ASSIGNABLE_STAFF_ID],
    ]);
  });

  it("refuses someone who isn't support staff", async () => {
    fakeDatabase.reset({ status: 'new', assignee_id: null });
    await assign('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b').expect(400);
    expect(fakeDatabase.state.updates).toHaveLength(0);
  });
});
