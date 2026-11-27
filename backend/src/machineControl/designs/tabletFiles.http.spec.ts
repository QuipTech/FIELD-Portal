import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { RequireActiveMachineGuard } from '../../machineLifecycle/activeMachine/requireActiveMachine.guard';
import { RequireMachineControlGuard } from '../access/requireMachineControl.guard';
import { TabletFilesController } from './tabletFiles.controller';
import { TabletFilesService } from './tabletFiles.service';

// The upload parser's own limits answer with the documented codes.
describe('POST /machines/:machineId/tablet-files limits', () => {
  let app: INestApplication;
  let url: string;
  const send = jest.fn().mockResolvedValue({ id: 'delivery' });
  const allow = { canActivate: () => true };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TabletFilesController],
      providers: [{ provide: TabletFilesService, useValue: { send } }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allow)
      .overrideGuard(RequirePermissionsGuard)
      .useValue(allow)
      .overrideGuard(RequireMachineControlGuard)
      .useValue(allow)
      .overrideGuard(RequireActiveMachineGuard)
      .useValue(allow)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = `http://127.0.0.1:${port}/machines/3f0c9a52-8f4e-4d57-9d0b-5a1c2e7b9f10/tablet-files`;
  });
  afterAll(() => app.close());

  const post = async (count: number, bytes: number) => {
    const body = new FormData();
    body.append('sendId', '6f1c0c1e-3b8f-4f7a-9d55-2a1f6c3b7e10');
    body.append('names', '[]');
    for (let index = 0; index < count; index++) {
      body.append('files', new Blob([new Uint8Array(bytes)]), `${index}.bin`);
    }
    const response = await fetch(url, { method: 'POST', body });
    return { status: response.status, body: await response.json() };
  };

  it('accepts 32 files', async () => {
    expect((await post(32, 1)).status).toBe(201);
  });

  it('answers tablet_too_many_files for a 33rd', async () => {
    expect(await post(33, 1)).toMatchObject({
      status: 400,
      body: { code: 'tablet_too_many_files' },
    });
  });

  it('answers tablet_file_too_large over 5 MiB', async () => {
    expect(await post(1, 5 * 1024 * 1024 + 2)).toMatchObject({
      status: 413,
      body: { code: 'tablet_file_too_large' },
    });
  });
});
