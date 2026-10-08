import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import { IncomingFile } from '../storage/types/storedFile';
import * as machineGalleryRepository from './machineGallery.repository';
import { assertMachineInTenant } from './machineHistory.service';
import { GalleryPhotoRow } from './types/machineHistoryRows';
import { GalleryPhoto } from './types/machineHistoryResponse';

const MAX_CAPTION_LENGTH = 200;

// A machine's own photos (the detail screen's gallery), as opposed to
// photos on its history entries (MachinePhotosService).
@Injectable()
export class MachineGalleryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  listPhotos = async (actor: AuthenticatedUser, machineId: string): Promise<GalleryPhoto[]> => {
    const rows = await this.databaseService.withTenant(actor.tenantId, async (client) => {
      await assertMachineInTenant(client, actor.tenantId, machineId);
      return machineGalleryRepository.listGalleryPhotos(client, actor.tenantId, machineId);
    });
    return Promise.all(rows.map(this.toGalleryPhoto));
  };

  // Checks the machine before touching S3; if the row can't be written
  // the stored object is removed again.
  uploadPhoto = async (
    actor: AuthenticatedUser,
    machineId: string,
    file: IncomingFile | undefined,
    caption: string | undefined,
  ): Promise<GalleryPhoto> => {
    await this.databaseService.withTenant(actor.tenantId, (client) =>
      assertMachineInTenant(client, actor.tenantId, machineId),
    );
    const stored = await this.storageService.uploadMachinePhoto(file, actor.tenantId, machineId);
    try {
      const row = await this.databaseService.withTenant(actor.tenantId, async (client) => {
        const inserted = await machineGalleryRepository.insertGalleryPhoto(client, {
          tenantId: actor.tenantId,
          machineId,
          userId: actor.userId,
          caption: caption?.trim().slice(0, MAX_CAPTION_LENGTH) || null,
          stored,
        });
        await authRepository.insertAuditLog(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
          action: 'create',
          entityType: 'machine_gallery_photo',
          entityId: inserted.id,
          metadata: { machineId, key: stored.key },
        });
        return inserted;
      });
      return this.toGalleryPhoto(row);
    } catch (error) {
      await this.storageService.deleteFile(stored.key, actor.tenantId).catch(() => undefined);
      throw error;
    }
  };

  private toGalleryPhoto = async (row: GalleryPhotoRow): Promise<GalleryPhoto> => ({
    id: row.id,
    caption: row.caption ?? row.file_name,
    contentType: row.content_type,
    uploadedAt: new Date(row.created_at).toISOString(),
    signedUrl: (await this.storageService.getSignedDownloadUrl(row.storage_key)).url,
  });
}
