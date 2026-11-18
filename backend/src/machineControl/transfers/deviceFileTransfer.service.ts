import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { hashToken } from '../../common/security/tokenHasher';
import { DatabaseService } from '../../database/database.service';
import { MachineDocumentType } from '../../machineHistory/dto/machineDocumentDtos';
import { StorageService } from '../../storage/storage.service';
import { IncomingFile } from '../../storage/types/storedFile';
import { findDeviceByTokenHash } from '../session/deviceSession.repository';
import {
  PairedDevice,
  revokedTokenError,
} from '../session/deviceSession.service';
import { findTransfer, insertTransfer } from './deviceFileTransfer.repository';

@Injectable()
export class DeviceFileTransferService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  async upload(
    device: PairedDevice,
    token: string,
    file: IncomingFile | undefined,
    transferId: string,
    documentType: MachineDocumentType,
  ) {
    const tokenHash = hashToken(token);
    const existing = await this.database.withTenant(
      device.tenantId,
      async (client) => {
        await this.assertCanTransfer(client, device, tokenHash);
        return findTransfer(client, device, transferId);
      },
    );
    if (existing) return existing;

    const stored = await this.storage.uploadMachineDocument(
      file,
      device.tenantId,
      device.machineId,
    );
    let receipt;
    try {
      receipt = await this.database.withTenant(
        device.tenantId,
        async (client) => {
          await this.assertCanTransfer(client, device, tokenHash);
          return insertTransfer(
            client,
            device,
            transferId,
            documentType,
            stored,
          );
        },
      );
    } catch (error) {
      await this.removeUnusedObject(stored.key, device.tenantId);
      throw error;
    }
    if (receipt) return receipt;

    // A concurrent retry won the insert. Keep its receipt and remove our copy.
    await this.removeUnusedObject(stored.key, device.tenantId);
    const winner = await this.database.withTenant(device.tenantId, (client) =>
      findTransfer(client, device, transferId),
    );
    if (!winner)
      throw new ServiceUnavailableException('Retry this file transfer.');
    return winner;
  }

  private async assertCanTransfer(
    client: PoolClient,
    device: PairedDevice,
    tokenHash: string,
  ) {
    const current = await findDeviceByTokenHash(client, tokenHash);
    if (current?.device_id !== device.deviceId) throw revokedTokenError();

    const { rowCount } = await client.query(
      `SELECT 1 FROM machines m
       JOIN tenants t ON t.id = m.tenant_id
       WHERE m.id = $1 AND m.tenant_id = $2 AND m.deleted_at IS NULL
         AND m.lifecycle_state = 'active' AND t.machine_control_enabled`,
      [device.machineId, device.tenantId],
    );
    if (!rowCount) {
      throw new ForbiddenException(
        'File transfers are unavailable for this machine.',
      );
    }
  }

  private removeUnusedObject(key: string, tenantId: string) {
    return this.storage.deleteFile(key, tenantId).catch(() => undefined);
  }
}
