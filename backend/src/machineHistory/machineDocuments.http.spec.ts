import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import { RequireActiveMachineGuard } from '../machineLifecycle/activeMachine/requireActiveMachine.guard';
import { MachineDocumentsController } from './machineDocuments.controller';
import { MachineDocumentsService } from './machineDocuments.service';

const MACHINE = '11111111-1111-4111-8111-111111111111';
const ENTRY = '22222222-2222-4222-8222-222222222222';
const PATH = `/machines/${MACHINE}/documents`;
const PDF = Buffer.from('%PDF-1.4 report');

const allow: CanActivate = {
  canActivate: (context: ExecutionContext) => {
    context.switchToHttp().getRequest().user = {
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'x@y.z',
    };
    return true;
  },
};

// The real controller, multipart handling and validation, as main.ts sets
// them up. Each route's required permission is read from its metadata.
describe('machine documents routes', () => {
  let app: INestApplication;
  const documents = {
    listDocuments: jest.fn().mockResolvedValue([]),
    uploadDocument: jest.fn().mockResolvedValue({ id: 'doc-1' }),
    deleteDocument: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MachineDocumentsController],
      providers: [{ provide: MachineDocumentsService, useValue: documents }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allow)
      .overrideGuard(RequirePermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RequireActiveMachineGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(IdempotencyInterceptor)
      .useValue({ intercept: (_context: unknown, next: any) => next.handle() })
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
  beforeEach(() => jest.clearAllMocks());

  const post = () =>
    request(app.getHttpServer()).post(PATH).attach('file', PDF, 'report.pdf');

  it('passes the file and its fields to the service', async () => {
    await post()
      .field('documentType', 'inspection')
      .field('historyEntryId', ENTRY)
      .expect(201);
    const [, machineId, file, dto] = documents.uploadDocument.mock.calls[0];
    expect(machineId).toBe(MACHINE);
    expect(file.originalname).toBe('report.pdf');
    expect(dto).toEqual({ documentType: 'inspection', historyEntryId: ENTRY });
  });

  it('refuses an unknown type, a bad entry id and extra fields', async () => {
    await post().field('documentType', 'invoice').expect(400);
    await post()
      .field('documentType', 'other')
      .field('historyEntryId', 'nope')
      .expect(400);
    await post()
      .field('documentType', 'other')
      .field('machineId', MACHINE)
      .expect(400);
    expect(documents.uploadDocument).not.toHaveBeenCalled();
  });

  it('refuses a file over 20 MB before it reaches the service', async () => {
    await request(app.getHttpServer())
      .post(PATH)
      .field('documentType', 'other')
      .attach('file', Buffer.alloc(20 * 1024 * 1024 + 1), 'big.pdf')
      .expect(413);
    expect(documents.uploadDocument).not.toHaveBeenCalled();
  });

  it('filters the list by a known type only', async () => {
    await request(app.getHttpServer())
      .get(`${PATH}?type=certificate`)
      .expect(200);
    expect(documents.listDocuments.mock.calls[0][2]).toBe('certificate');
    await request(app.getHttpServer()).get(`${PATH}?type=nope`).expect(400);
  });

  it('deletes with 204 and rejects a bad id', async () => {
    await request(app.getHttpServer()).delete(`${PATH}/${ENTRY}`).expect(204);
    await request(app.getHttpServer()).delete(`${PATH}/nope`).expect(400);
  });

  it('requires the agreed permission on each route', () => {
    const permissionOf = (handler: keyof MachineDocumentsController) =>
      new Reflector().get(
        'requiredPermissions',
        MachineDocumentsController.prototype[handler],
      );
    expect(permissionOf('list')).toEqual(['machine.view']);
    expect(permissionOf('upload')).toEqual(['history.create']);
    expect(permissionOf('remove')).toEqual(['machine.manage']);
  });
});
