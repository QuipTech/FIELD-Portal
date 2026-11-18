import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { hashToken } from '../../common/security/tokenHasher';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../../storage/storage.service';
import { findDeviceByTokenHash } from '../session/deviceSession.repository';
import {
  PairedDevice,
  revokedTokenError,
} from '../session/deviceSession.service';
import { DesignFile, UpdateDesignDelivery } from './designDelivery.types';
import { publicFile } from './designLibrary.service';

interface DeviceDelivery {
  id: string;
  projectId: string;
  project: string;
  versionId: string;
  status: string;
  files: DesignFile[];
}

@Injectable()
export class DeviceDesignDeliveryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  next = (device: PairedDevice, token: string) =>
    this.withDevice(device, token, async (client) => {
      const job = await this.nextDelivery(client, device);
      return {
        delivery: job ? { ...job, files: job.files.map(publicFile) } : null,
      };
    });

  download = (device: PairedDevice, token: string, id: string, index: number) =>
    this.withDevice(device, token, async (client) => {
      const job = await this.nextDelivery(client, device);
      const file = job?.id === id ? job.files[index] : undefined;
      if (!file)
        throw new NotFoundException(
          'Design file not found in the active delivery.',
        );
      return this.storage.getSignedDownloadUrl(file.key);
    });

  update = (
    device: PairedDevice,
    token: string,
    id: string,
    dto: UpdateDesignDelivery,
  ) =>
    this.withDevice(device, token, async (client) => {
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 1))',
        [device.deviceId],
      );
      const {
        rows: [job],
      } = await client.query<{ status: string }>(
        `SELECT status FROM mc_design_deliveries
         WHERE id = $1 AND device_id = $2 AND device_tenant_id = $3 AND machine_id = $4`,
        [id, device.deviceId, device.tenantId, device.machineId],
      );
      if (!job) throw new NotFoundException('Design delivery not found.');
      if (job.status === dto.status) return { status: job.status };

      const active = await this.nextDelivery(client, device);
      if (
        active?.id !== id ||
        (dto.status === 'arrived' && job.status !== 'downloading')
      ) {
        throw new ConflictException(
          'This delivery cannot move to the requested status.',
        );
      }
      await client.query(
        `UPDATE mc_design_deliveries SET status = $2, error = $3, updated_at = now()
         WHERE id = $1`,
        [
          id,
          dto.status,
          dto.status === 'failed' ? dto.error?.trim() || null : null,
        ],
      );
      return { status: dto.status };
    });

  private async nextDelivery(client: PoolClient, device: PairedDevice) {
    const { rows } = await client.query<DeviceDelivery>(
      `SELECT d.id, d.project_id AS "projectId", d.project_name AS project,
              d.version_id AS "versionId", d.status, v.files
       FROM mc_design_deliveries d
       JOIN mc_design_versions v ON v.id = d.version_id
       WHERE d.device_id = $1 AND d.device_tenant_id = $2 AND d.machine_id = $3
         AND d.status IN ('waiting', 'downloading')
       ORDER BY d.created_at, d.id LIMIT 1`,
      [device.deviceId, device.tenantId, device.machineId],
    );
    return rows[0];
  }

  private withDevice<T>(
    device: PairedDevice,
    token: string,
    work: (client: PoolClient) => Promise<T>,
  ) {
    return this.db.withTenant(device.tenantId, async (client) => {
      const current = await findDeviceByTokenHash(client, hashToken(token));
      if (current?.device_id !== device.deviceId) throw revokedTokenError();
      const { rowCount } = await client.query(
        `SELECT 1 FROM machines m JOIN tenants t ON t.id = m.tenant_id
         WHERE m.id = $1 AND m.tenant_id = $2 AND m.deleted_at IS NULL
           AND m.lifecycle_state = 'active' AND t.deleted_at IS NULL AND t.machine_control_enabled`,
        [device.machineId, device.tenantId],
      );
      if (!rowCount)
        throw new ForbiddenException(
          'Design delivery is unavailable for this machine.',
        );
      return work(client);
    });
  }
}
