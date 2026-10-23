import {
  BadRequestException,
  CanActivate,
  Controller,
  ExecutionContext,
  INestApplication,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { DatabaseService } from '../database/database.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { ClaimOutcome } from './idempotency.repository';

// The real interceptor on a throwaway route. The repository is an
// in-memory map with the same claim / complete / release behaviour.
interface StoredKey {
  route: string;
  requestHash: string;
  status?: number;
  body?: unknown;
}
const keys = new Map<string, StoredKey>();

jest.mock('./idempotency.repository', () => ({
  claimKey: async (
    _client: unknown,
    ref: { userId: string; key: string; route: string; requestHash: string },
  ): Promise<ClaimOutcome> => {
    const stored = keys.get(`${ref.userId}:${ref.key}`);
    if (!stored) {
      keys.set(`${ref.userId}:${ref.key}`, {
        route: ref.route,
        requestHash: ref.requestHash,
      });
      return { state: 'claimed' };
    }
    return stored.status === undefined
      ? {
          state: 'in_progress',
          route: stored.route,
          requestHash: stored.requestHash,
        }
      : {
          state: 'done',
          route: stored.route,
          requestHash: stored.requestHash,
          status: stored.status,
          body: stored.body,
        };
  },
  completeKey: async (
    _client: unknown,
    ref: { userId: string; key: string; status: number; body: unknown },
  ) => {
    const stored = keys.get(`${ref.userId}:${ref.key}`)!;
    keys.set(`${ref.userId}:${ref.key}`, {
      ...stored,
      status: ref.status,
      body: ref.body,
    });
  },
  releaseKey: async (
    _client: unknown,
    ref: { userId: string; key: string },
  ) => {
    keys.delete(`${ref.userId}:${ref.key}`);
  },
}));

let created = 0;
let failNext = false;

@Controller('things')
class ThingsController {
  @Post(':group')
  @UseInterceptors(IdempotencyInterceptor)
  create(@Param('group') group: string) {
    if (failNext) {
      failNext = false;
      throw new BadRequestException('Try again');
    }
    created += 1;
    return { id: created, group };
  }
}

class FakeAuthGuard implements CanActivate {
  canActivate = (context: ExecutionContext) => {
    context.switchToHttp().getRequest().user = {
      userId: 'user-1',
      tenantId: 'tenant-1',
    };
    return true;
  };
}

describe('IdempotencyInterceptor', () => {
  let app: INestApplication;

  beforeAll(async () => {
    UseGuards(FakeAuthGuard)(ThingsController);
    const moduleRef = await Test.createTestingModule({
      controllers: [ThingsController],
      providers: [
        IdempotencyInterceptor,
        {
          provide: DatabaseService,
          useValue: {
            withTenant: (
              _tenantId: string,
              work: (client: unknown) => unknown,
            ) => work({}),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    keys.clear();
    created = 0;
  });

  const post = (path: string, key?: string, body: object = { note: 'a' }) => {
    const call = request(app.getHttpServer()).post(path).send(body);
    return key ? call.set('Idempotency-Key', key) : call;
  };

  it('writes once and replays the first response for a retried key', async () => {
    const first = await post('/things/a', 'key-00000001').expect(201);
    const retry = await post('/things/a', 'key-00000001').expect(201);
    expect(retry.body).toEqual(first.body);
    expect(created).toBe(1);
  });

  it('treats each key, and no key, as a new write', async () => {
    await post('/things/a', 'key-00000001').expect(201);
    await post('/things/a', 'key-00000002').expect(201);
    await post('/things/a').expect(201);
    expect(created).toBe(3);
  });

  it('refuses a key reused for a different request', async () => {
    await post('/things/a', 'key-00000001').expect(201);
    await post('/things/b', 'key-00000001').expect(422);
  });

  it('refuses a key reused with a different body', async () => {
    await post('/things/a', 'key-00000001', { note: 'a' }).expect(201);
    await post('/things/a', 'key-00000001', { note: 'b' }).expect(422);
    expect(created).toBe(1);
  });

  it('replays a retry whose body has the same fields in another order', async () => {
    await post('/things/a', 'key-00000001', { a: 1, b: 2 }).expect(201);
    await post('/things/a', 'key-00000001', { b: 2, a: 1 }).expect(201);
    expect(created).toBe(1);
  });

  it('frees the key when the write fails, so the retry runs', async () => {
    failNext = true;
    await post('/things/a', 'key-00000001').expect(400);
    await post('/things/a', 'key-00000001').expect(201);
    expect(created).toBe(1);
  });

  it('rejects a malformed key', async () => {
    await post('/things/a', 'bad key').expect(400);
    expect(created).toBe(0);
  });
});
