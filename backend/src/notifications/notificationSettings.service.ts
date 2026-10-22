import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as devicesRepository from './devices/pushDevices.repository';
import { PushDeviceRow } from './devices/pushDevices.repository';
import * as preferencesRepository from './preferences/notificationPreferences.repository';
import {
  RegisterPushDeviceDto,
  SaveNotificationPreferencesDto,
} from './dto/notificationSettingsDtos';
import { NotificationKind } from './types/notificationResponse';

const DEVICE_NOT_FOUND_MESSAGE = 'Device not found.';

export interface PushDevice {
  id: string;
  deviceType: string;
  // Only the end, to tell devices apart; the full token never leaves.
  tokenSuffix: string;
  appVersion: string | null;
  lastSeenAt: string;
  registeredAt: string;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  mutedKinds: NotificationKind[];
}

// Before anything is saved: everything on, nothing muted.
const DEFAULT_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  emailEnabled: true,
  mutedKinds: [],
};

const toPushDevice = (row: PushDeviceRow): PushDevice => ({
  id: row.id,
  deviceType: row.device_type,
  tokenSuffix: row.push_token.slice(-6),
  appVersion: row.app_version,
  lastSeenAt: row.last_seen_at.toISOString(),
  registeredAt: row.created_at.toISOString(),
});

// The caller's push devices and notification preferences: what a push
// sender needs (registered tokens, push on, kind not muted). Nothing
// sends pushes yet; the in-app feed is unaffected by these settings.
@Injectable()
export class NotificationSettingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  listDevices = (actor: AuthenticatedUser): Promise<PushDevice[]> =>
    this.withOwnRows(actor, async (client, scope) =>
      (await devicesRepository.listPushDevices(client, scope)).map(
        toPushDevice,
      ),
    );

  registerDevice = (
    actor: AuthenticatedUser,
    dto: RegisterPushDeviceDto,
  ): Promise<PushDevice> =>
    this.withOwnRows(actor, async (client, scope) =>
      toPushDevice(
        await devicesRepository.upsertPushDevice(client, {
          ...scope,
          deviceType: dto.deviceType,
          pushToken: dto.pushToken,
          appVersion: dto.appVersion ?? null,
        }),
      ),
    );

  // On sign-out, so the device stops receiving pushes.
  removeDevice = (actor: AuthenticatedUser, deviceId: string): Promise<void> =>
    this.withOwnRows(actor, async (client, scope) => {
      const removed = await devicesRepository.deletePushDevice(client, {
        ...scope,
        deviceId,
      });
      if (!removed) throw new NotFoundException(DEVICE_NOT_FOUND_MESSAGE);
    });

  getPreferences = (
    actor: AuthenticatedUser,
  ): Promise<NotificationPreferences> =>
    this.withOwnRows(actor, async (client, scope) => {
      const row = await preferencesRepository.findNotificationPreferences(
        client,
        scope,
      );
      return row ? this.toPreferences(row) : DEFAULT_PREFERENCES;
    });

  savePreferences = (
    actor: AuthenticatedUser,
    dto: SaveNotificationPreferencesDto,
  ): Promise<NotificationPreferences> =>
    this.withOwnRows(actor, async (client, scope) =>
      this.toPreferences(
        await preferencesRepository.saveNotificationPreferences(client, {
          ...scope,
          ...dto,
        }),
      ),
    );

  private withOwnRows = <T>(
    actor: AuthenticatedUser,
    work: (
      client: PoolClient,
      scope: { tenantId: string; userId: string },
    ) => Promise<T>,
  ): Promise<T> =>
    this.databaseService.withTenant(actor.tenantId, (client) =>
      work(client, { tenantId: actor.tenantId, userId: actor.userId }),
    );

  private toPreferences = (
    row: preferencesRepository.NotificationPreferencesRow,
  ): NotificationPreferences => ({
    pushEnabled: row.push_enabled,
    emailEnabled: row.email_enabled,
    mutedKinds: row.muted_kinds as NotificationKind[],
  });
}
