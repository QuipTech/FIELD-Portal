import { Injectable, NotFoundException } from '@nestjs/common';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { IncomingFile } from '../storage/types/storedFile';
import { assertMachineAccessible } from './assertMachineAccessible';
import {
  MachineDocumentType,
  UploadMachineDocumentDto,
} from './dto/machineDocumentDtos';
import {
  toMachineDocument,
  toMachineDocumentFile,
} from './machineDocumentMapper';
import * as machineDocumentsRepository from './machineDocuments.repository';
import {
  MachineDocument,
  MachineDocumentFile,
} from './types/machineHistoryResponse';

const ENTRY_NOT_FOUND_MESSAGE = 'History entry not found.';
const DOCUMENT_NOT_FOUND_MESSAGE = 'Document not found.';

// Files about one machine, on their own or added with a history entry. Rows
// live in the machine's owning organisation. A 'contribute' share adds files
// (to the machine, or to the caller's own entries) and deletes only what it
// uploaded; the owner deletes any. Deleting is a soft delete, since this is the
// machine's record.
@Injectable()
export class MachineDocumentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  listDocuments = async (
    actor: AuthenticatedUser,
    machineId: string,
    documentType: MachineDocumentType | null,
  ): Promise<MachineDocument[]> => {
    const { rows, isShared } = await this.databaseService.withActor(
      actor,
      async (client) => {
        const { access } = await assertMachineAccessible(client, machineId);
        return {
          isShared: access.tenantId !== actor.tenantId,
          rows: await machineDocumentsRepository.listDocuments(client, {
            tenantId: access.tenantId,
            machineId,
            documentType,
          }),
        };
      },
    );
    return Promise.all(
      rows.map((row) =>
        toMachineDocument(
          this.storageService,
          row,
          !isShared || row.uploaded_by === actor.userId,
        ),
      ),
    );
  };

  // Checks access and the entry before touching S3, then stores the file
  // and its row; if the row can't be written the object is removed again.
  uploadDocument = async (
    actor: AuthenticatedUser,
    machineId: string,
    file: IncomingFile | undefined,
    dto: UploadMachineDocumentDto,
  ): Promise<MachineDocumentFile> => {
    const historyEntryId = dto.historyEntryId ?? null;
    const ownerTenantId = await this.assertCanUpload(
      actor,
      machineId,
      historyEntryId,
    );
    const stored = await this.storageService.uploadMachineDocument(
      file,
      ownerTenantId,
      machineId,
    );
    try {
      const row = await this.databaseService.withActor(
        actor,
        async (client) => {
          const inserted = await machineDocumentsRepository.insertDocument(
            client,
            {
              tenantId: ownerTenantId,
              machineId,
              historyEntryId,
              documentType: dto.documentType,
              userId: actor.userId,
              stored,
            },
          );
          await authRepository.insertAuditLog(client, {
            tenantId: actor.tenantId,
            userId: actor.userId,
            action: 'create',
            entityType: 'machine_document',
            entityId: inserted.id,
            metadata: {
              machineId,
              historyEntryId,
              documentType: dto.documentType,
              fileName: stored.fileName,
              key: stored.key,
            },
          });
          return inserted;
        },
      );
      return await toMachineDocumentFile(this.storageService, row);
    } catch (error) {
      await this.storageService
        .deleteFile(stored.key, ownerTenantId)
        .catch(() => undefined);
      throw error;
    }
  };

  deleteDocument = (
    actor: AuthenticatedUser,
    machineId: string,
    documentId: string,
  ): Promise<void> =>
    this.databaseService.withActor(actor, async (client) => {
      const { access } = await assertMachineAccessible(
        client,
        machineId,
        'contribute',
      );
      const isShared = access.tenantId !== actor.tenantId;
      const deleted = await machineDocumentsRepository.softDeleteDocument(
        client,
        {
          tenantId: access.tenantId,
          machineId,
          documentId,
          uploadedBy: isShared ? actor.userId : null,
        },
      );
      if (!deleted) throw new NotFoundException(DOCUMENT_NOT_FOUND_MESSAGE);
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'delete',
        entityType: 'machine_document',
        entityId: documentId,
        metadata: { machineId, fileName: deleted.file_name },
      });
    });

  // The machine's owning organisation, once the caller may add to it. On a
  // shared machine, an entry must be the caller's own.
  private assertCanUpload = (
    actor: AuthenticatedUser,
    machineId: string,
    historyEntryId: string | null,
  ): Promise<string> =>
    this.databaseService.withActor(actor, async (client) => {
      const { access } = await assertMachineAccessible(
        client,
        machineId,
        'contribute',
      );
      if (historyEntryId) {
        const isShared = access.tenantId !== actor.tenantId;
        const canAttach = await machineDocumentsRepository.canAttachToEntry(
          client,
          {
            tenantId: access.tenantId,
            machineId,
            entryId: historyEntryId,
            requiredAuthorId: isShared ? actor.userId : null,
          },
        );
        if (!canAttach) throw new NotFoundException(ENTRY_NOT_FOUND_MESSAGE);
      }
      return access.tenantId;
    });
}
