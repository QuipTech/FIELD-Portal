import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { hashToken } from '../../common/security/tokenHasher';
import { DatabaseService } from '../../database/database.service';
import * as sessionRepository from './deviceSession.repository';
import { DEVICE_TOKEN_REVOKED, SessionState } from './machineAppEvents';

export interface PairedDevice {
  deviceId: string;
  machineId: string;
  tenantId: string;
  machineLabel: string;
}

export interface DeviceSessionStatus extends SessionState {
  deviceId: string;
  machine: { id: string; label: string };
}

const OFFLINE_STATE: SessionState = {
  status: 'pending',
  tabletOnline: false,
  portalOnline: false,
};

export const revokedTokenError = () =>
  new UnauthorizedException({
    statusCode: 401,
    error: 'Unauthorized',
    code: DEVICE_TOKEN_REVOKED,
    message: 'This tablet is no longer connected to a machine.',
  });

export const newDeviceToken = (): string =>
  randomBytes(32).toString('base64url');

// The tablet's side of a session: its token proves which paired device it
// is, can be swapped for a new one, and can end the session.
@Injectable()
export class DeviceSessionService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Null when the token no longer works.
  authenticate = async (deviceToken: string): Promise<PairedDevice | null> => {
    const row = await sessionRepository.findDeviceByTokenHash(
      this.databaseService,
      hashToken(deviceToken),
    );
    return (
      row && {
        deviceId: row.device_id,
        machineId: row.machine_id,
        tenantId: row.tenant_id,
        machineLabel: row.machine_label,
      }
    );
  };

  // Callers check access to the machine first.
  getState = async (machineId: string): Promise<SessionState> =>
    (await sessionRepository.findSessionState(
      this.databaseService,
      machineId,
    )) ?? OFFLINE_STATE;

  describe = async (device: PairedDevice): Promise<DeviceSessionStatus> => ({
    deviceId: device.deviceId,
    machine: { id: device.machineId, label: device.machineLabel },
    ...(await this.getState(device.machineId)),
  });

  // The new token is only ever returned here; the old one works 5 more minutes.
  refreshToken = async (deviceToken: string) => {
    const newToken = newDeviceToken();
    const rotated = await this.databaseService.transaction((client) =>
      sessionRepository.rotateDeviceToken(
        client,
        hashToken(deviceToken),
        hashToken(newToken),
      ),
    );
    if (!rotated) throw revokedTokenError();
    return { deviceToken: newToken };
  };

  endSession = async (deviceToken: string): Promise<void> => {
    const ended = await this.databaseService.transaction((client) =>
      sessionRepository.endDeviceSession(client, hashToken(deviceToken)),
    );
    if (!ended) throw revokedTokenError();
  };

  setTabletOnline = (deviceId: string, socketId: string, online: boolean) =>
    sessionRepository.setDeviceOnline(this.databaseService, {
      deviceId,
      socketId,
      online,
    });

  watch = (socketId: string, machineId: string) =>
    sessionRepository.watchMachine(this.databaseService, socketId, machineId);

  unwatch = (socketId: string, machineId: string | null) =>
    sessionRepository.unwatchMachine(this.databaseService, socketId, machineId);

  touchLiveSockets = (deviceIds: string[], socketIds: string[]) =>
    sessionRepository.touchLiveSockets(
      this.databaseService,
      deviceIds,
      socketIds,
    );

  sweep = (staleSeconds: number, timeoutMinutes: number) =>
    sessionRepository.sweepSessions(
      this.databaseService,
      staleSeconds,
      timeoutMinutes,
    );
}
