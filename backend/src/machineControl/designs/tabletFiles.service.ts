import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PoolClient } from 'pg';
import * as authRepository from '../../auth/auth.repository';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { DatabaseService } from '../../database/database.service';
import { requireMachineAccess } from '../../machineSharing/access/machineAccess';
import { StorageService } from '../../storage/storage.service';
import { IncomingFile } from '../../storage/types/storedFile';
import { MACHINE_CONTROL_DISABLED_CODE } from '../access/machineControlAccess';
import * as designs from './designDelivery.repository';
import {
  DesignFile,
  MAX_DESIGN_FILE_BYTES,
  MAX_DESIGN_FILES,
  MAX_DESIGN_VERSION_BYTES,
} from './designDelivery.types';
import { readDesignPaths } from './designPaths';
import * as repo from './tabletFiles.repository';
import {
  SendTabletFiles,
  TABLET_FILES_PROJECT,
  TabletFileSend,
} from './tabletFiles.types';

export const tabletFileErrors = {
  invalid: (message: string) =>
    new BadRequestException({ code: 'tablet_files_invalid', message }),
  tooMany: () =>
    new BadRequestException({
      code: 'tablet_too_many_files',
      message: `Send up to ${MAX_DESIGN_FILES} files at a time.`,
    }),
  fileTooLarge: () =>
    new PayloadTooLargeException({
      code: 'tablet_file_too_large',
      message: 'A file can be up to 5 MB.',
    }),
  sendTooLarge: () =>
    new PayloadTooLargeException({
      code: 'tablet_send_too_large',
      message: 'One send can be up to 20 MB in total.',
    }),
  noTablet: () =>
    new ConflictException({
      code: 'machine_has_no_tablet',
      message: 'This machine has no tablet. Add one on its Machine app tab.',
    }),
  removed: () =>
    new ConflictException({
      code: 'tablet_removed',
      message:
        "This machine's tablet was disconnected. Add it again before sending.",
    }),
  sendIdReused: () =>
    new ConflictException({
      code: 'tablet_send_id_reused',
      message: 'This send ID has already been used for other files.',
    }),
};

const readNames = (names: string, files: IncomingFile[]): string[] => {
  let paths: string[];
  try {
    paths = readDesignPaths(names, files.length);
  } catch {
    throw tabletFileErrors.invalid(
      'Use different, Windows-compatible file names.',
    );
  }
  if (paths.some((path) => path.includes('/'))) {
    throw tabletFileErrors.invalid('Send file names without folders.');
  }
  return paths;
};

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// The first line is the entry's title; the second keeps the names and sizes
// in exports.
const describeSend = (files: DesignFile[]) =>
  `${files.length === 1 ? '1 file' : `${files.length} files`} sent to the tablet\n` +
  files
    .map((file) => `${file.path} (${formatSize(file.sizeBytes)})`)
    .join(', ');

// "Send to tablet": one design delivery (a new version of the "Remote
// session files" project) for the tablet on one machine. Needs 'contribute'
// access to the machine, like starting a remote session.
@Injectable()
export class TabletFilesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  list = (
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<{ sends: TabletFileSend[] }> =>
    this.db.withActor(actor, async (client) => {
      const access = await requireMachineAccess(client, machineId, 'read');
      return {
        sends: await repo.listSends(client, access.tenantId, machineId),
      };
    });

  async send(
    actor: AuthenticatedUser,
    machineId: string,
    dto: SendTabletFiles,
    files: IncomingFile[],
  ): Promise<TabletFileSend> {
    if (!files.length)
      throw tabletFileErrors.invalid('Choose a file to send.');
    if (files.length > MAX_DESIGN_FILES) throw tabletFileErrors.tooMany();
    const names = readNames(dto.names, files);
    if (files.some((file) => !file.size))
      throw tabletFileErrors.invalid("Empty files can't be sent.");
    if (files.some((file) => file.size > MAX_DESIGN_FILE_BYTES))
      throw tabletFileErrors.fileTooLarge();
    if (
      files.reduce((sum, file) => sum + file.size, 0) > MAX_DESIGN_VERSION_BYTES
    )
      throw tabletFileErrors.sendTooLarge();

    const hashed = files.map((file, index) => ({
      path: names[index],
      sizeBytes: file.size,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
    }));
    const manifestHash = createHash('sha256')
      .update(JSON.stringify(hashed))
      .digest('hex');

    // Refuse, or answer a retry, before storing anything.
    const earlier = await this.db.withActor(actor, async (client) => {
      const access = await requireMachineAccess(
        client,
        machineId,
        'contribute',
      );
      const sent = await this.findRetry(
        client,
        actor,
        access.tenantId,
        machineId,
        dto.sendId,
        manifestHash,
      );
      if (!sent) await this.requireTablet(client, actor, machineId);
      return sent;
    });
    if (earlier) return earlier;

    const manifest: DesignFile[] = [];
    const removeStored = () =>
      Promise.allSettled(
        manifest.map(({ key }) =>
          this.storage.deleteFile(key, actor.tenantId),
        ),
      );
    try {
      for (const [index, file] of files.entries()) {
        const stored = await this.storage.uploadMachineDesign(
          file,
          actor.tenantId,
          names[index],
        );
        manifest.push({ ...hashed[index], key: stored.key });
      }
      const result = await this.db.withActor(actor, async (client) => {
        const access = await requireMachineAccess(
          client,
          machineId,
          'contribute',
        );
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 2))',
          [dto.sendId],
        );
        const sent = await this.findRetry(
          client,
          actor,
          access.tenantId,
          machineId,
          dto.sendId,
          manifestHash,
        );
        if (sent) return { send: sent, isRetry: true };

        const target = await this.requireTablet(client, actor, machineId);
        const version = await designs.insertVersion(
          client,
          actor.tenantId,
          TABLET_FILES_PROJECT,
          manifest,
        );
        const {
          rows: [delivery],
        } = await designs.insertDeliveries(
          client,
          actor.tenantId,
          version,
          dto.sendId,
          manifestHash,
          [target],
        );
        await repo.insertSendHistoryEntry(client, {
          tenantId: access.tenantId,
          machineId,
          userId: actor.userId,
          description: describeSend(manifest),
          deliveryId: delivery.id,
        });
        await authRepository.insertAuditLog(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
          action: 'create',
          entityType: 'mc_design_delivery',
          entityId: delivery.id,
          metadata: {
            machineId,
            files: manifest.map(({ path, sizeBytes }) => ({
              path,
              sizeBytes,
            })),
          },
        });
        const [send] = await repo.listSends(
          client,
          access.tenantId,
          machineId,
          delivery.id,
        );
        return { send, isRetry: false };
      });
      // A concurrent retry won: its copies are the ones in use.
      if (result.isRetry) await removeStored();
      return result.send;
    } catch (error) {
      await removeStored();
      throw error;
    }
  }

  private async findRetry(
    client: PoolClient,
    actor: AuthenticatedUser,
    owningTenantId: string,
    machineId: string,
    sendId: string,
    manifestHash: string,
  ): Promise<TabletFileSend | null> {
    const existing = await repo.findSend(client, actor.tenantId, sendId);
    if (!existing) return null;
    const [send] =
      existing.machineId === machineId && existing.manifestHash === manifestHash
        ? await repo.listSends(client, owningTenantId, machineId, existing.id)
        : [];
    if (!send) throw tabletFileErrors.sendIdReused();
    return send;
  }

  // The machine's connected tablet, FIELD ID or code-paired alike.
  private async requireTablet(
    client: PoolClient,
    actor: AuthenticatedUser,
    machineId: string,
  ) {
    const {
      rows: [target],
    } = await designs.listTargets(client, actor.tenantId, {
      versionId: '',
      machineIds: [machineId],
    });
    if (target) return target;
    // Connected, but its owning organisation has Machine Control off.
    if (await repo.hasConnectedTablet(client, machineId)) {
      throw new ForbiddenException({
        code: MACHINE_CONTROL_DISABLED_CODE,
        message: "Machine Control isn't turned on for this machine's owner.",
      });
    }
    throw (await repo.hasRemovedTablet(client, machineId))
      ? tabletFileErrors.removed()
      : tabletFileErrors.noTablet();
  }
}
