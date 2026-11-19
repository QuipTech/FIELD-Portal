import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { DeviceSessionController } from './deviceSession.controller';
import { DeviceSessionService, revokedTokenError } from './deviceSession.service';

describe('tablet disconnect HTTP contract', () => {
  let app: INestApplication;
  const sessions = {
    authenticate: jest.fn().mockResolvedValue(null),
    endSession: jest.fn(async (token: string) => {
      if (token !== 'known-credential') throw revokedTokenError();
    }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DeviceSessionController],
      providers: [{ provide: DeviceSessionService, useValue: sessions }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  it('returns empty 204 on initial and repeated known-token DELETE', async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request(app.getHttpServer()).delete('/mc/device/session')
        .set('Authorization', 'Bearer known-credential').expect(204);
      expect(response.text).toBe('');
    }
    expect(sessions.endSession).toHaveBeenCalledWith('known-credential');
  });
  it('keeps session validation guarded with the exact revoked-token error', async () => {
    const response = await request(app.getHttpServer()).get('/mc/device/session')
      .set('Authorization', 'Bearer known-credential').expect(401);
    expect(response.body.code).toBe('DEVICE_TOKEN_REVOKED');
  });
  it('rejects unknown, missing or malformed credentials on DELETE', async () => {
    await request(app.getHttpServer()).delete('/mc/device/session').expect(401);
    await request(app.getHttpServer()).delete('/mc/device/session')
      .set('Authorization', 'Bearer unknown').expect(401);
    await request(app.getHttpServer()).delete('/mc/device/session')
      .set('Authorization', 'Bearer known-credential extra').expect(401);
  });
});
