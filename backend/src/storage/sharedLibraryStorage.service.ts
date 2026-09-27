import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { expiresInSeconds } from './signedUrlHelpers';
import { DOCUMENT_RULE, validateIncomingFile } from './storageFileRules';
import { SHARED_DOCUMENTS_PREFIX, toSafeFileName } from './storageKeys';
import { StorageBucket } from './storageBucket';
import { IncomingFile, SignedUrl, StoredFile } from './types/storedFile';

const UPLOAD_URL_TTL_SECONDS = 15 * 60;

// The shared QuipTech library under documents/shared/. Only Owner-guarded
// code may use this service — it's the one path allowed to write or delete
// outside a tenant's own folders.
@Injectable()
export class SharedLibraryStorageService {
  constructor(private readonly storageBucket: StorageBucket) {}

  // Large files: the browser PUTs straight to S3 and must send exactly
  // this Content-Type, as it's signed.
  createSignedUploadUrl = async (
    key: string,
    contentType: string,
  ): Promise<SignedUrl> => {
    const command = new PutObjectCommand({
      Bucket: this.storageBucket.requireBucket(),
      Key: key,
      ContentType: contentType,
    });
    return {
      url: await getSignedUrl(this.storageBucket.requireClient(), command, {
        expiresIn: UPLOAD_URL_TTL_SECONDS,
      }),
      expiresAt: expiresInSeconds(UPLOAD_URL_TTL_SECONDS),
    };
  };

  // Smaller files sent through the backend (e.g. a new version, ≤ 20 MB).
  uploadSharedDocument = async (
    file: IncomingFile | undefined,
    key: string,
  ): Promise<StoredFile> => {
    const { contentType } = validateIncomingFile(file, DOCUMENT_RULE);
    this.assertSharedKey(key);
    await this.storageBucket.putObject(key, file!.buffer, contentType);
    return {
      key,
      fileName: file!.originalname,
      contentType,
      sizeBytes: file!.size,
      uploadedAt: new Date().toISOString(),
    };
  };

  // Size in bytes of a stored object, or null when it isn't there (yet).
  findObjectSize = async (key: string): Promise<number | null> => {
    try {
      const head = await this.storageBucket.requireClient().send(
        new HeadObjectCommand({
          Bucket: this.storageBucket.requireBucket(),
          Key: key,
        }),
      );
      return head.ContentLength ?? 0;
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  };

  deleteSharedDocumentFile = async (key: string): Promise<void> => {
    this.assertSharedKey(key);
    await this.storageBucket.requireClient().send(
      new DeleteObjectCommand({
        Bucket: this.storageBucket.requireBucket(),
        Key: key,
      }),
    );
  };

  buildVersionKey = (
    documentId: string,
    versionId: string,
    fileName: string,
  ): string =>
    `${SHARED_DOCUMENTS_PREFIX}/${documentId}/${versionId}/${toSafeFileName(fileName)}`;

  private assertSharedKey = (key: string): void => {
    const isShared =
      key.startsWith(`${SHARED_DOCUMENTS_PREFIX}/`) &&
      !key.split('/').some((part) => part === '..' || part === '');
    if (!isShared) throw new ForbiddenException('Not a shared-library file.');
  };
}
