import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import request = require('supertest');
import { DEVICE_PAIRING_THROTTLER } from '../pairing/devicePairingThrottle';
import {
  DeviceTabletController,
  DeviceTabletRegisterController,
} from './deviceTablet.controller';
import { ConnectByFieldIdDto } from './tabletAccess.dtos';
import { TabletAccessService } from './tabletAccess.service';

// The tablet's registration routes: validation, the bearer token passed on,
// and a FIELD ID accepted however it was typed.
describe('tablet registration HTTP contract', () => {
  let app: INestApplication;
  const tablets = {
    register: jest.fn().mockResolvedValue({ fieldId: '482915307', tabletToken: 't' }),
    registration: jest.fn().mockResolvedValue({ assigned: false }),
    openSession: jest.fn().mockResolvedValue({ deviceToken: 'd' }),
    changePassword: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([DEVICE_PAIRING_THROTTLER])],
      controllers: [DeviceTabletRegisterController, DeviceTabletController],
      providers: [{ provide: TabletAccessService, useValue: tablets }],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(() => app.close());

  const server = () => app.getHttpServer();

  it('registers with a password of at least 8 characters', async () => {
    await request(server()).post('/mc/device/register').send({ password: 'short' }).expect(400);
    await request(server())
      .post('/mc/device/register')
      .send({ password: 'long-enough', platform: 'windows' })
      .expect(201);
    expect(tablets.register).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'long-enough' }),
      null,
    );
  });

  it('passes the tablet token on', async () => {
    await request(server()).get('/mc/device/registration').set('Authorization', 'Bearer abc').expect(200);
    await request(server()).post('/mc/device/registration/session').set('Authorization', 'Bearer abc').expect(200);
    await request(server())
      .put('/mc/device/registration/password')
      .set('Authorization', 'Bearer abc')
      .send({ password: 'long-enough' })
      .expect(204);
    expect(tablets.registration).toHaveBeenCalledWith('abc');
    expect(tablets.openSession).toHaveBeenCalledWith('abc');
  });

  it('accepts a FIELD ID typed in groups', async () => {
    const dto = plainToInstance(ConnectByFieldIdDto, { fieldId: '482 915-307', password: 'x' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.fieldId).toBe('482915307');
    expect(await validate(plainToInstance(ConnectByFieldIdDto, { fieldId: '123', password: 'x' }))).toHaveLength(1);
  });
});
