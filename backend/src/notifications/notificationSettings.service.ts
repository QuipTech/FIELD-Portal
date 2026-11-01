import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as devicesRepository from './devices/pushDevices.repository';
import { PushDeviceRow } from './devices/pushDevices.repository';
import { PushDevicesService } from './push/pushDevices.service';
import * as preferencesRepository from './preferences/notificationPreferences.repository';
import {
  RegisterPushDeviceDto,
  SaveNotificationPreferencesDto,
} from './dto/notificationSettingsDtos';
import { NotificationKind } from './types/notificationResponse';

export interface PushDevice {
  id: string;
  deviceType: string;
  // Only the end, to tell devices apart; the full token never leaves.
  tokenSuffix: string;
  appVersion: string | null;
  bundleId: string | null;
  apnsEnvironment: 'sandbox' | 'production' | null;
  // Has an SNS endpoint that SNS hasn't disabled.
  canReceivePush: boolean;
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
  bundleId: row.bundle_id,
  apnsEnvironment: row.apns_environment,
  canReceivePush: Boolean(row.endpoint_arn) && !row.disabled_at,
  lastSeenAt: row.last_seen_at.toISOString(),
  registeredAt: row.created_at.toISOString(),
});

// The caller's push devices and notification preferences. Registering a
// device creates its SNS endpoint (push/pushDevices.service.ts); the push
// sender honours push on/off and muted kinds. The in-app feed is
// unaffected by these settings.
@Injectable()
export class NotificationSettingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly pushDevices: PushDevicesService,
  ) {}

  listDevices = (actor: AuthenticatedUser): Promise<PushDevice[]> =>
    this.withOwnRows(actor, async (client, scope) =>
      (await devicesRepository.listPushDevices(client, scope)).map(
        toPushDevice,
      ),
    );

  // On every app launch and sign-in; the response's id is what the app
  // sends to remove the device on sign-out.
  registerDevice = async (
    actor: AuthenticatedUser,
    dto: RegisterPushDeviceDto,
  ): Promise<PushDevice> =>
    toPushDevice(
      await this.pushDevices.register(actor, {
        deviceType: dto.deviceType,
        pushToken: dto.pushToken,
        appVersion: dto.appVersion ?? null,
        bundleId: dto.bundleId ?? null,
        apnsEnvironment: dto.apnsEnvironment ?? null,
      }),
    );

  // On sign-out, so the device stops receiving pushes.
  removeDevice = (actor: AuthenticatedUser, deviceId: string): Promise<void> =>
    this.pushDevices.remove(actor, deviceId);

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
