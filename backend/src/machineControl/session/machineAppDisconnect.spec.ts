import { MachineAppEventListenerService } from './machineAppEventListener.service';
import { MachineAppHeartbeatService } from './machineAppHeartbeat.service';
import { DeviceSessionController } from './deviceSession.controller';
import { DeviceSessionService } from './deviceSession.service';
import { ConfigService } from '@nestjs/config';
import { readBearerToken } from './deviceToken.guard';

const device = {
  deviceId: 'd1',
  machineId: 'm1',
  tenantId: 't1',
  machineLabel: 'Machine',
};

describe('disconnect delivery and reconciliation', () => {
  it('forwards the exact session:ended payload before closing the device room', () => {
    const order: string[] = [];
    const emit = jest.fn(() => order.push('event'));
    const disconnectSockets = jest.fn(() => order.push('disconnect'));
    const namespace = {
      to: jest.fn(() => ({ emit })),
      in: jest.fn(() => ({ disconnectSockets })),
    };
    const listener = new MachineAppEventListenerService({} as ConfigService);
    (listener as any).namespace = namespace;
    (listener as any).forward(
      JSON.stringify({
        event: 'session:ended',
        deviceId: 'd1',
        machineId: 'm1',
        reason: 'portal_disconnected',
      }),
    );
    expect(namespace.to).toHaveBeenCalledWith('mc-watch:m1');
    expect(namespace.to).toHaveBeenCalledWith('mc-device:d1');
    expect(emit).toHaveBeenCalledWith('session:ended', {
      deviceId: 'd1',
      machineId: 'm1',
      reason: 'portal_disconnected',
    });
    expect(order).toEqual(['event', 'event', 'disconnect']);
  });

  it('closes a revoked socket after a missed PG notification, before renewing presence', async () => {
    const order: string[] = [];
    const socket = {
      id: 's1',
      connected: true,
      data: { device },
      emit: jest.fn(() => order.push('ended')),
      disconnect: jest.fn(() => {
        socket.connected = false;
        order.push('closed');
      }),
    };
    const sessions = {
      isCurrentDevice: jest.fn().mockResolvedValue(false),
      touchLiveSockets: jest.fn(),
    };
    const heartbeat = new MachineAppHeartbeatService(
      sessions as unknown as DeviceSessionService,
    );
    heartbeat.attach({ sockets: new Map([['s1', socket]]) } as any);
    await heartbeat.vouchForLocalSockets();
    expect(order).toEqual(['ended', 'closed']);
    expect(sessions.touchLiveSockets).not.toHaveBeenCalled();
  });

  it('preserves pairing and sockets when the database is temporarily unavailable', async () => {
    const socket = {
      id: 's1',
      connected: true,
      data: { device },
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    const sessions = {
      isCurrentDevice: jest.fn().mockRejectedValue(new Error('offline')),
      touchLiveSockets: jest.fn().mockResolvedValue(undefined),
    };
    const heartbeat = new MachineAppHeartbeatService(
      sessions as unknown as DeviceSessionService,
    );
    heartbeat.attach({ sockets: new Map([['s1', socket]]) } as any);
    await heartbeat.vouchForLocalSockets();
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('passes the DELETE bearer credential to the atomic retry-aware operation', async () => {
    const endSession = jest.fn().mockResolvedValue(undefined);
    const controller = new DeviceSessionController({ endSession } as any);
    await controller.end('Bearer test-private-credential');
    expect(endSession).toHaveBeenCalledWith('test-private-credential');
    expect(readBearerToken('Bearer value extra')).toBeNull();
    expect(readBearerToken('Basic value')).toBeNull();
  });
});
