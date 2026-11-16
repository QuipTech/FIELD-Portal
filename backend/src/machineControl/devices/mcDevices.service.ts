import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { DatabaseService } from '../../database/database.service';
import * as devicesRepository from './mcDevices.repository';

export interface McDevice {
  id: string;
  machine: {
    id: string;
    label: string;
    manufacturer: string;
    model: string;
    site: string | null;
  };
  serialNumber: string | null;
  platform: string | null;
  appVersion: string | null;
  pairedAt: string;
  online: boolean;
  // When the tablet last talked to FIELD; null until it first does.
  lastSeenAt: string | null;
}

export interface McDeviceList {
  items: McDevice[];
  // Active machines the caller could connect a tablet to, connected or not.
  connectableMachineCount: number;
}

const toIso = (value: Date | null): string | null =>
  value ? new Date(value).toISOString() : null;

// Machine Control → Devices and Overview: the tablets connected so far.
@Injectable()
export class McDevicesService {
  constructor(private readonly databaseService: DatabaseService) {}

  listDevices = (actor: AuthenticatedUser): Promise<McDeviceList> =>
    this.databaseService.withActor(actor, async (client) => {
      const rows = await devicesRepository.listConnectedDevices(
        client,
        actor.tenantId,
      );
      return {
        items: rows.map((row) => ({
          id: row.id,
          machine: {
            id: row.machine_id,
            label: row.machine_label,
            manufacturer: row.manufacturer_name,
            model: row.model_name,
            site: row.site,
          },
          serialNumber: row.serial_number,
          platform: row.platform,
          appVersion: row.app_version,
          pairedAt: new Date(row.paired_at).toISOString(),
          online: row.online_since !== null,
          lastSeenAt: toIso(row.last_seen_at),
        })),
        connectableMachineCount:
          await devicesRepository.countConnectableMachines(
            client,
            actor.tenantId,
          ),
      };
    });
}
