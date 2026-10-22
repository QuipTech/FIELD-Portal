import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DatabaseService } from '../database/database.service';
import { StorageBucket } from '../storage/storageBucket';
import { IncomingFile } from '../storage/types/storedFile';
import { LOGO_RULE, validateIncomingFile } from '../storage/storageFileRules';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { insertAuditLog } from '../auth/auth.repository';

@Injectable()
export class KnowledgeBrandLogoService {
  constructor(
    private readonly database: DatabaseService,
    private readonly bucket: StorageBucket,
  ) {}
  upload = async (
    actor: AuthenticatedUser,
    brandId: string,
    file: IncomingFile | undefined,
  ) => {
    const { contentType, extension } = validateIncomingFile(file, LOGO_RULE);
    const fileId = randomUUID();
    const key = `knowledge/brand-logos/${brandId}/${fileId}.${extension}`;
    await this.bucket.putObject(key, file!.buffer, contentType);
    try {
      await this.database.withActor(actor, async (client) => {
        const result = await client.query(
          'UPDATE knowledge_brands SET logo_file_id=$1,logo_storage_key=$2 WHERE id=$3 RETURNING id',
          [fileId, key, brandId],
        );
        if (!result.rowCount) throw new NotFoundException('Brand not found.');
        await insertAuditLog(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
          action: 'update',
          entityType: 'knowledge_brand',
          entityId: brandId,
          metadata: { event: 'logo_updated', fileId },
        });
      });
    } catch (error) {
      await this.bucket
        .requireClient()
        .send(
          new DeleteObjectCommand({
            Bucket: this.bucket.requireBucket(),
            Key: key,
          }),
        )
        .catch(() => undefined);
      throw error;
    }
    return { fileId };
  };
}
