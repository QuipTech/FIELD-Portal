import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import { IncomingFile } from '../storage/types/storedFile';
import * as machineGalleryRepository from './machineGallery.repository';
import { assertMachineAccessible } from './assertMachineAccessible';
import { GalleryPhotoRow } from './types/machineHistoryRows';
import { GalleryPhoto } from './types/machineHistoryResponse';

const MAX_CAPTION_LENGTH = 200;
const PHOTO_NOT_FOUND_MESSAGE = 'Photo not found.';

// A machine's own photos (the detail screen's gallery), as opposed to
// photos on its history entries (MachinePhotosService). A 'contribute' share
// adds photos and deletes only what it uploaded; the owner deletes any.
// Deleting is a soft delete, since this is the machine's record.
@Injectable()
export class MachineGalleryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  listPhotos = async (
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<GalleryPhoto[]> => {
    const { rows, isShared } = await this.databaseService.withActor(
      actor,
      async (client) => {
        const { access } = await assertMachineAccessible(client, machineId);
        return {
          isShared: access.tenantId !== actor.tenantId,
          rows: await machineGalleryRepository.listGalleryPhotos(
            client,
            access.tenantId,
            machineId,
          ),
        };
      },
    );
    return Promise.all(
      rows.map((row) =>
        this.toGalleryPhoto(row, !isShared || row.uploaded_by === actor.userId),
      ),
    );
  };

  // Checks the machine before touching S3; if the row can't be written
  // the stored object is removed again. On a shared machine ('contribute')
  // the photo belongs to the owning organisation, stored under its prefix.
  uploadPhoto = async (
    actor: AuthenticatedUser,
    machineId: string,
    file: IncomingFile | undefined,
    caption: string | undefined,
  ): Promise<GalleryPhoto> => {
    const { access } = await this.databaseService.withActor(actor, (client) =>
      assertMachineAccessible(client, machineId, 'contribute'),
    );
    const stored = await this.storageService.uploadMachinePhoto(
      file,
      access.tenantId,
      machineId,
    );
    try {
      const row = await this.databaseService.withActor(
        actor,
        async (client) => {
          const inserted = await machineGalleryRepository.insertGalleryPhoto(
            client,
            {
              tenantId: access.tenantId,
              machineId,
              userId: actor.userId,
              caption: caption?.trim().slice(0, MAX_CAPTION_LENGTH) || null,
              stored,
            },
          );
          await authRepository.insertAuditLog(client, {
            tenantId: actor.tenantId,
            userId: actor.userId,
            action: 'create',
            entityType: 'machine_gallery_photo',
            entityId: inserted.id,
            metadata: { machineId, key: stored.key },
          });
          return inserted;
        },
      );
      return this.toGalleryPhoto(row, true);
    } catch (error) {
      await this.storageService
        .deleteFile(stored.key, access.tenantId)
        .catch(() => undefined);
      throw error;
    }
  };

  deletePhoto = (
    actor: AuthenticatedUser,
    machineId: string,
    photoId: string,
  ): Promise<void> =>
    this.databaseService.withActor(actor, async (client) => {
      const { access } = await assertMachineAccessible(
        client,
        machineId,
        'contribute',
      );
      const isShared = access.tenantId !== actor.tenantId;
      const scope = { tenantId: access.tenantId, machineId, photoId };
      const deleted = await machineGalleryRepository.softDeleteGalleryPhoto(
        client,
        { ...scope, uploadedBy: isShared ? actor.userId : null },
      );
      if (!deleted) throw new NotFoundException(PHOTO_NOT_FOUND_MESSAGE);
      await machineGalleryRepository.clearCoverPhoto(client, scope);
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'delete',
        entityType: 'machine_gallery_photo',
        entityId: photoId,
        metadata: { machineId, fileName: deleted.file_name },
      });
    });

  private toGalleryPhoto = async (
    row: GalleryPhotoRow,
    canDelete: boolean,
  ): Promise<GalleryPhoto> => ({
    id: row.id,
    caption: row.caption ?? row.file_name,
    contentType: row.content_type,
    uploadedAt: new Date(row.created_at).toISOString(),
    signedUrl: (await this.storageService.getSignedDownloadUrl(row.storage_key))
      .url,
    canDelete,
    isCover: row.is_cover,
  });
}
