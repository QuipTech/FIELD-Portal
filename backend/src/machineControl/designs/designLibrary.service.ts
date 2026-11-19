import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PoolClient } from 'pg';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../../storage/storage.service';
import { IncomingFile } from '../../storage/types/storedFile';
import * as repo from './designDelivery.repository';
import {
  DesignFile,
  MAX_DESIGN_VERSION_BYTES,
  MAX_DESIGN_FILE_BYTES,
  PreviewDesignDelivery,
  SendDesignDelivery,
  UploadDesignVersion,
} from './designDelivery.types';
import { readDesignPaths } from './designPaths';

export const publicFile = ({ path, sizeBytes, sha256 }: DesignFile) => ({
  path,
  sizeBytes,
  sha256,
});
const publicVersion = (version: repo.DesignVersion) => ({
  ...version,
  files: version.files.map(publicFile),
});

@Injectable()
export class DesignLibraryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  list = (actor: AuthenticatedUser) =>
    this.db.withActor(actor, async (client) => ({
      versions: (await repo.listVersions(client, actor.tenantId)).rows.map(
        publicVersion,
      ),
      deliveries: (await repo.listDeliveries(client, actor.tenantId)).rows,
    }));

  targets = (actor: AuthenticatedUser) =>
    this.db.withActor(
      actor,
      async (client) => (await repo.listTargets(client, actor.tenantId)).rows,
    );

  async upload(
    actor: AuthenticatedUser,
    dto: UploadDesignVersion,
    files: IncomingFile[],
  ) {
    const project = dto.project.normalize('NFC').trim();
    if (!project || /\p{Cc}/u.test(project))
      throw new BadRequestException('Enter a project name.');
    const paths = readDesignPaths(dto.paths, files.length);
    if (files.some((file) => file.size > MAX_DESIGN_FILE_BYTES)) {
      throw new PayloadTooLargeException('A design file can be up to 5 MiB.');
    }
    if (
      files.reduce((sum, file) => sum + file.size, 0) > MAX_DESIGN_VERSION_BYTES
    ) {
      throw new PayloadTooLargeException('A version can contain up to 20 MiB.');
    }
    const manifest: DesignFile[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const path = paths[index];
        const stored = await this.storage.uploadMachineDesign(
          file,
          actor.tenantId,
          path.split('/').at(-1)!,
        );
        manifest.push({
          key: stored.key,
          path,
          sizeBytes: file.size,
          sha256: createHash('sha256').update(file.buffer).digest('hex'),
        });
      }
      const version = await this.db.withActor(actor, (client) =>
        repo.insertVersion(client, actor.tenantId, project, manifest),
      );
      return publicVersion(version);
    } catch (error) {
      await Promise.allSettled(
        manifest.map(({ key }) => this.storage.deleteFile(key, actor.tenantId)),
      );
      throw error;
    }
  }

  async download(actor: AuthenticatedUser, versionId: string, index: number) {
    const version = await this.db.withActor(actor, (client) =>
      this.requireVersion(client, actor.tenantId, versionId),
    );
    const file = version.files[index];
    if (!file) throw new NotFoundException('Design file not found.');
    return this.storage.getSignedDownloadUrl(
      file.key,
      file.path.split('/').at(-1),
    );
  }

  preview = (actor: AuthenticatedUser, dto: PreviewDesignDelivery) =>
    this.db.withActor(actor, (client) =>
      this.buildPreview(client, actor.tenantId, dto),
    );

  send = (actor: AuthenticatedUser, dto: SendDesignDelivery) =>
    this.db.withActor(actor, async (client) => {
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 2))',
        [dto.batchId],
      );
      // Serialize confirmations for a project so a stale preview cannot skip a concurrent send.
      const version = await this.requireVersion(
        client,
        actor.tenantId,
        dto.versionId,
      );
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [version.projectId],
      );
      const { rows } = await client.query<{
        version_id: string;
        preview_hash: string;
      }>(
        'SELECT DISTINCT version_id, preview_hash FROM mc_design_deliveries WHERE sender_tenant_id = $1 AND batch_id = $2',
        [actor.tenantId, dto.batchId],
      );
      if (rows.length) {
        if (
          rows[0].version_id !== version.id ||
          rows[0].preview_hash !== dto.previewHash
        )
          throw new ConflictException('This send ID has already been used.');
        return { batchId: dto.batchId };
      }
      const preview = await this.buildPreview(client, actor.tenantId, dto);
      if (preview.previewHash !== dto.previewHash) {
        throw new ConflictException(
          'The destinations or replacement plan changed. Review the send again.',
        );
      }
      await repo.insertDeliveries(
        client,
        actor.tenantId,
        version,
        dto.batchId,
        dto.previewHash,
        preview.targets,
      );
      return { batchId: dto.batchId };
    });

  private async requireVersion(
    client: PoolClient,
    tenantId: string,
    id: string,
  ) {
    const version = await repo.findVersion(client, tenantId, id);
    if (!version) throw new NotFoundException('Design version not found.');
    return version;
  }

  private async buildPreview(
    client: PoolClient,
    tenantId: string,
    dto: PreviewDesignDelivery,
  ) {
    if (Boolean(dto.site) === Boolean(dto.machineIds)) {
      throw new BadRequestException('Select machines or a site.');
    }
    const version = await this.requireVersion(client, tenantId, dto.versionId);
    const { rows: targets } = await repo.listTargets(client, tenantId, dto);
    if (
      !targets.length ||
      (dto.machineIds && targets.length !== new Set(dto.machineIds).size)
    ) {
      throw new BadRequestException(
        'One or more destinations have no eligible paired tablet.',
      );
    }
    const { rows: previous } = await repo.previousDesigns(
      client,
      version.projectId,
      targets.map((target) => target.deviceId),
    );
    const byDevice = new Map(previous.map((row) => [row.deviceId, row]));
    const destinations = targets.map((target) => ({
      ...target,
      replaces: byDevice.get(target.deviceId) ?? null,
    }));
    const previewHash = createHash('sha256')
      .update(
        JSON.stringify({
          version: version.id,
          targets,
          previous: previous.map(({ deviceId, versionId }) => ({
            deviceId,
            versionId,
          })),
        }),
      )
      .digest('hex');
    return {
      version: publicVersion(version),
      targets: destinations,
      previewHash,
    };
  }
}
