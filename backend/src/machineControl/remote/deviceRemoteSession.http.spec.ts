import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { DeviceSessionService } from '../session/deviceSession.service';
import { DeviceTokenGuard } from '../session/deviceToken.guard';
import { DeviceRemoteSessionController } from './remoteSession.controller';
import { RemoteSessionService } from './remoteSession.service';

// The tablet's remote support routes: device token required, decisions
// validated, and the service called with the authenticated tablet.
describe('tablet remote support HTTP contract', () => {
  let app: INestApplication;
  const device = { deviceId: 'd1', machineId: 'm1', tenantId: 't1', machineLabel: 'PLANT-1' };
  const sessionId = '6f1c0c1e-3b8f-4f7a-9d55-2a1f6c3b7e10';
  const sessions = {
    authenticate: jest.fn(async (token: string) => (token === 'good' ? device : null)),
  };
  const remote = {
    currentForDevice: jest.fn().mockResolvedValue({ session: null }),
    decide: jest.fn().mockResolvedValue({ id: sessionId, status: 'active' }),
    endFromTablet: jest.fn().mockResolvedValue({ id: sessionId, status: 'ended' }),
    tabletHeartbeat: jest.fn().mockResolvedValue({ id: sessionId, status: 'active' }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DeviceRemoteSessionController],
      providers: [
        DeviceTokenGuard,
        { provide: DeviceSessionService, useValue: sessions },
        { provide: RemoteSessionService, useValue: remote },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  const server = () => app.getHttpServer();

  it('needs a working device token', async () => {
    const response = await request(server()).get('/mc/device/remote-sessions/current').expect(401);
    expect(response.body.code).toBe('DEVICE_TOKEN_REVOKED');
    await request(server()).get('/mc/device/remote-sessions/current').set('Authorization', 'Bearer bad').expect(401);
  });

  it('returns the open session', async () => {
    const response = await request(server())
      .get('/mc/device/remote-sessions/current')
      .set('Authorization', 'Bearer good')
      .expect(200);
    expect(response.body).toEqual({ session: null });
    expect(remote.currentForDevice).toHaveBeenCalledWith(device, 'good');
  });

  it('takes an Allow or Decline and refuses anything else', async () => {
    await request(server())
      .post(`/mc/device/remote-sessions/${sessionId}/decision`)
      .set('Authorization', 'Bearer good')
      .send({ decision: 'allow', allowControl: false })
      .expect(200);
    expect(remote.decide).toHaveBeenCalledWith(device, 'good', sessionId, { decision: 'allow', allowControl: false });
    await request(server())
      .post(`/mc/device/remote-sessions/${sessionId}/decision`)
      .set('Authorization', 'Bearer good')
      .send({ decision: 'maybe' })
      .expect(400);
    await request(server())
      .post('/mc/device/remote-sessions/not-a-uuid/decision')
      .set('Authorization', 'Bearer good')
      .send({ decision: 'allow' })
      .expect(400);
  });

  it('heartbeats and ends with 200', async () => {
    await request(server())
      .post(`/mc/device/remote-sessions/${sessionId}/heartbeat`)
      .set('Authorization', 'Bearer good')
      .send({ interacted: true })
      .expect(200);
    expect(remote.tabletHeartbeat).toHaveBeenCalledWith(device, 'good', sessionId, true);
    await request(server())
      .post(`/mc/device/remote-sessions/${sessionId}/end`)
      .set('Authorization', 'Bearer good')
      .expect(200);
    expect(remote.endFromTablet).toHaveBeenCalledWith(device, 'good', sessionId);
  });
});
