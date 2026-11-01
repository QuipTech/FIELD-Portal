import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import * as devicesRepository from '../devices/pushDevices.repository';
import { PushDeviceRow } from '../devices/pushDevices.repository';
import { PushConfig } from './pushConfig';
import { ApnsEnvironment, resolvePushTarget } from './pushPlatform';
import { SnsPushService } from './snsPush.service';

const DEVICE_NOT_FOUND_MESSAGE = 'Device not found.';

export interface RegisterDeviceInput {
  deviceType: string;
  pushToken: string;
  appVersion: string | null;
  bundleId: string | null;
  apnsEnvironment: ApnsEnvironment | null;
}

// A device's SNS endpoint follows its registration: created (or revived)
// when the app registers its token, deleted on sign-out and when the
// person's account is deleted or removed. SNS trouble never fails a
// registration: the row is saved and the next app launch tries again.
@Injectable()
export class PushDevicesService {
  private readonly logger = new Logger(PushDevicesService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: PushConfig,
    private readonly sns: SnsPushService,
  ) {}

  register = async (
    actor: AuthenticatedUser,
    input: RegisterDeviceInput,
  ): Promise<PushDeviceRow> => {
    const target = resolvePushTarget(input, this.config.defaultBundleId);
    const row = await this.databaseService.withActor(actor, (client) =>
      devicesRepository.registerPushDevice(client, {
        deviceType: input.deviceType,
        pushToken: input.pushToken,
        appVersion: input.appVersion,
        bundleId: target.bundleId,
        apnsEnvironment: target.apnsEnvironment,
      }),
    );
    const platformApplicationArn = target.platformKey
      ? this.config.platformApplicationArn(target.platformKey)
      : null;
    if (!platformApplicationArn) {
      if (target.platformKey)
        this.logger.warn(
          `No SNS platform application for ${target.platformKey}; device ${row.id} saved without an endpoint.`,
        );
      return row;
    }
    try {
      const endpointArn = await this.sns.ensureEndpoint({
        platformApplicationArn,
        token: input.pushToken,
        userId: actor.userId,
      });
      await this.databaseService.withTenant(actor.tenantId, (client) =>
        devicesRepository.saveEndpoint(client, {
          tenantId: actor.tenantId,
          deviceId: row.id,
          endpointArn,
        }),
      );
      return { ...row, endpoint_arn: endpointArn, disabled_at: null };
    } catch (error) {
      this.logger.error(
        `SNS endpoint for device ${row.id} failed: ${String(error)}`,
      );
      return row;
    }
  };

  // Sign-out: the endpoint first, then the row. 404 when it's already gone.
  remove = async (
    actor: AuthenticatedUser,
    deviceId: string,
  ): Promise<void> => {
    const scope = { tenantId: actor.tenantId, userId: actor.userId, deviceId };
    const device = await this.databaseService.withTenant(
      actor.tenantId,
      (client) => devicesRepository.findPushDevice(client, scope),
    );
    if (!device) throw new NotFoundException(DEVICE_NOT_FOUND_MESSAGE);
    if (device.endpoint_arn)
      await this.deleteEndpointQuietly(device.endpoint_arn);
    await this.databaseService.withTenant(actor.tenantId, (client) =>
      devicesRepository.deletePushDevice(client, scope),
    );
  };

  // Account deletion or removal: every endpoint of the person. Their rows
  // go with the account (delete_user_account / admin_remove_user).
  removeAllForUser = async (
    userId: string,
    tenantId: string,
  ): Promise<void> => {
    // Never throws: deleting the account matters more than tidying SNS.
    try {
      const devices = await this.databaseService.withTenant(
        tenantId,
        (client) =>
          devicesRepository.listPushDevices(client, { tenantId, userId }),
      );
      for (const device of devices)
        if (device.endpoint_arn)
          await this.deleteEndpointQuietly(device.endpoint_arn);
    } catch (error) {
      this.logger.warn(
        `Couldn't list push devices for user ${userId}: ${String(error)}`,
      );
    }
  };

  private deleteEndpointQuietly = async (endpointArn: string) => {
    try {
      await this.sns.deleteEndpoint(endpointArn);
    } catch (error) {
      this.logger.warn(
        `Couldn't delete SNS endpoint ${endpointArn}: ${String(error)}`,
      );
    }
  };
}
