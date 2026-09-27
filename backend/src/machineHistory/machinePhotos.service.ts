import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import { IncomingFile, UploadedFile } from '../storage/types/storedFile';
import * as machineHistoryRepository from './machineHistory.repository';
import { assertMachineInTenant } from './machineHistory.service';
import { toMachinePhoto } from './machinePhotoMapper';
import { MachinePhoto } from './types/machineHistoryResponse';

const ENTRY_NOT_FOUND_MESSAGE = 'History entry not found.';
const PHOTO_NOT_FOUND_MESSAGE = 'Photo not found.';

interface PhotoTarget {
  machineId: string;
  entryId: string;
}

// Photos on technical history entries. Deleting is a soft delete — the
// photo disappears from the portal but its row and S3 object stay, since
// history is part of the machine's compliance/audit record.
@Injectable()
export class MachinePhotosService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  // Checks the entry before touching S3, then stores the file and its
  // row; if the row can't be written the object is removed again.
  uploadPhoto = async (
    actor: AuthenticatedUser,
    target: PhotoTarget,
    file: IncomingFile | undefined,
  ): Promise<{ photo: MachinePhoto; file: UploadedFile }> => {
    await this.assertEntryInTenant(actor, target);
    const stored = await this.storageService.uploadMachinePhoto(
      file,
      actor.tenantId,
      target.machineId,
    );
    try {
      const row = await this.databaseService.withTenant(
        actor.tenantId,
        async (client) => {
          const inserted = await machineHistoryRepository.insertPhotoAttachment(
            client,
            {
              tenantId: actor.tenantId,
              entryId: target.entryId,
              userId: actor.userId,
              bucket: this.storageService.requireBucket(),
              stored,
            },
          );
          await authRepository.insertAuditLog(client, {
            tenantId: actor.tenantId,
            userId: actor.userId,
            action: 'create',
            entityType: 'machine_photo',
            entityId: inserted.id,
            metadata: { ...target, key: stored.key },
          });
          return inserted;
        },
      );
      const photo = await toMachinePhoto(this.storageService, row);
      return {
        photo,
        file: {
          key: stored.key,
          signedUrl: photo.signedUrl,
          uploadedAt: stored.uploadedAt,
        },
      };
    } catch (error) {
      await this.storageService
        .deleteFile(stored.key, actor.tenantId)
        .catch(() => undefined);
      throw error;
    }
  };

  deletePhoto = async (
    actor: AuthenticatedUser,
    target: PhotoTarget & { photoId: string },
  ): Promise<void> => {
    await this.assertEntryInTenant(actor, target);
    await this.databaseService.withTenant(actor.tenantId, async (client) => {
      const isDeleted = await machineHistoryRepository.softDeletePhoto(client, {
        tenantId: actor.tenantId,
        ...target,
      });
      if (!isDeleted) throw new NotFoundException(PHOTO_NOT_FOUND_MESSAGE);
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'delete',
        entityType: 'machine_photo',
        entityId: target.photoId,
        metadata: { machineId: target.machineId, entryId: target.entryId },
      });
    });
  };

  private assertEntryInTenant = (
    actor: AuthenticatedUser,
    target: PhotoTarget,
  ): Promise<void> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      await assertMachineInTenant(client, actor.tenantId, target.machineId);
      const exists = await machineHistoryRepository.historyEntryExists(client, {
        tenantId: actor.tenantId,
        ...target,
      });
      if (!exists) throw new NotFoundException(ENTRY_NOT_FOUND_MESSAGE);
    });
}
