import { ForbiddenException, Injectable } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { expiresInSeconds, toAttachmentDisposition } from './signedUrlHelpers';
import {
  AVATAR_RULE,
  DOCUMENT_RULE,
  LOGO_RULE,
  PHOTO_RULE,
  validateIncomingFile,
} from './storageFileRules';
import {
  buildAvatarKey,
  buildBrandingLogoKey,
  buildDataExportKey,
  buildDocumentKey,
  buildMachinePhotoKey,
  isTenantOwnedKey,
} from './storageKeys';
import { StorageBucket } from './storageBucket';
import { IncomingFile, SignedUrl, StoredFile } from './types/storedFile';

const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

// Tenant-owned files: documents/, photos/, avatars/, branding/, exports/
// under {tenantId}/.
// The bucket is private: clients only ever get short-lived signed URLs,
// and the database stores object keys. (Shared-library files:
// SharedLibraryStorageService.)
@Injectable()
export class StorageService {
  constructor(private readonly storageBucket: StorageBucket) {}

  uploadDocument = (
    file: IncomingFile | undefined,
    tenantId: string,
  ): Promise<StoredFile> => {
    const { contentType } = validateIncomingFile(file, DOCUMENT_RULE);
    return this.storeFile(
      buildDocumentKey(tenantId, file!.originalname),
      file!,
      contentType,
    );
  };

  uploadMachinePhoto = (
    file: IncomingFile | undefined,
    tenantId: string,
    machineId: string,
  ): Promise<StoredFile> => {
    const { contentType } = validateIncomingFile(file, PHOTO_RULE);
    return this.storeFile(
      buildMachinePhotoKey(tenantId, machineId, file!.originalname),
      file!,
      contentType,
    );
  };

  uploadAvatar = (
    file: IncomingFile | undefined,
    tenantId: string,
    userId: string,
  ): Promise<StoredFile> => {
    const { extension, contentType } = validateIncomingFile(file, AVATAR_RULE);
    return this.storeFile(
      buildAvatarKey(tenantId, userId, extension),
      file!,
      contentType,
    );
  };

  uploadBrandingLogo = (
    file: IncomingFile | undefined,
    tenantId: string,
  ): Promise<StoredFile> => {
    const { extension, contentType } = validateIncomingFile(file, LOGO_RULE);
    return this.storeFile(
      buildBrandingLogoKey(tenantId, extension),
      file!,
      contentType,
    );
  };

  // A generated "My data" export (server-built JSON, not a user upload).
  storeDataExport = async (
    ids: { tenantId: string; userId: string; requestId: string },
    json: string,
  ): Promise<{ key: string; sizeBytes: number }> => {
    const key = buildDataExportKey(ids.tenantId, ids.userId, ids.requestId);
    const body = Buffer.from(json, 'utf8');
    await this.storageBucket.putObject(key, body, 'application/json');
    return { key, sizeBytes: body.length };
  };

  // Images render inline; pass `downloadFileName` to make browsers save
  // the file under its original name instead.
  getSignedDownloadUrl = async (
    key: string,
    downloadFileName?: string,
  ): Promise<SignedUrl> => {
    const command = new GetObjectCommand({
      Bucket: this.storageBucket.requireBucket(),
      Key: key,
      ResponseContentDisposition: downloadFileName
        ? toAttachmentDisposition(downloadFileName)
        : undefined,
    });
    return {
      url: await getSignedUrl(this.storageBucket.requireClient(), command, {
        expiresIn: DOWNLOAD_URL_TTL_SECONDS,
      }),
      expiresAt: expiresInSeconds(DOWNLOAD_URL_TTL_SECONDS),
    };
  };

  // Tenant-scoped hard delete — refuses any key outside the tenant's own
  // folders (documents/, photos/, avatars/, branding/, exports/ under
  // {tenantId}/).
  deleteFile = async (key: string, tenantId: string): Promise<void> => {
    if (!isTenantOwnedKey(key, tenantId)) {
      throw new ForbiddenException(
        "That file doesn't belong to your organisation.",
      );
    }
    await this.storageBucket.requireClient().send(
      new DeleteObjectCommand({
        Bucket: this.storageBucket.requireBucket(),
        Key: key,
      }),
    );
  };

  // The whole object in memory — for server-side processing (page counts,
  // indexing); callers cap the size they're willing to read.
  readObject = async (key: string): Promise<Uint8Array> => {
    const object = await this.storageBucket.requireClient().send(
      new GetObjectCommand({
        Bucket: this.storageBucket.requireBucket(),
        Key: key,
      }),
    );
    if (!object.Body) throw new Error(`Empty S3 object: ${key}`);
    return object.Body.transformToByteArray();
  };

  requireBucket = (): string => this.storageBucket.requireBucket();

  private storeFile = async (
    key: string,
    file: IncomingFile,
    contentType: string,
  ): Promise<StoredFile> => {
    await this.storageBucket.putObject(key, file.buffer, contentType);
    return {
      key,
      fileName: file.originalname,
      contentType,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
    };
  };
}
