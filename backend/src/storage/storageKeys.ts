import { randomUUID } from 'crypto';

// Top-level folders in the bucket. Tenant-owned objects always sit at
// {folder}/{tenantId}/…, which is what deleteFile checks.
export const STORAGE_FOLDERS = ['documents', 'photos', 'avatars'] as const;

// The shared knowledge library (tenant_id IS NULL) lives beside tenant
// folders; tenant ids are UUIDs, so they can never equal "shared".
export const SHARED_DOCUMENTS_PREFIX = 'documents/shared';

const MAX_KEY_FILE_NAME_LENGTH = 150;

// Keys stay ASCII and URL-safe; the original name is kept in the database
// for display and downloads.
export const toSafeFileName = (fileName: string): string =>
  fileName
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/-\./g, '.')
    .replace(/^-|-$/g, '')
    .slice(-MAX_KEY_FILE_NAME_LENGTH) || 'file';

export const buildDocumentKey = (tenantId: string, fileName: string) =>
  `documents/${tenantId}/${randomUUID()}-${toSafeFileName(fileName)}`;

export const buildSharedDocumentKey = (
  documentId: string,
  versionNumber: number,
  fileName: string,
) =>
  `${SHARED_DOCUMENTS_PREFIX}/${documentId}/v${versionNumber}/${toSafeFileName(fileName)}`;

export const buildMachinePhotoKey = (
  tenantId: string,
  machineId: string,
  fileName: string,
) =>
  `photos/${tenantId}/${machineId}/${randomUUID()}-${toSafeFileName(fileName)}`;

// One avatar per user: a new upload with the same extension overwrites it.
export const buildAvatarKey = (
  tenantId: string,
  userId: string,
  extension: string,
) => `avatars/${tenantId}/${userId}.${extension}`;

// The multi-tenant boundary for deletes: only keys under one of this
// tenant's own folders, with no path tricks.
export const isTenantOwnedKey = (key: string, tenantId: string): boolean =>
  !key.split('/').some((segment) => segment === '..' || segment === '') &&
  STORAGE_FOLDERS.some((folder) => key.startsWith(`${folder}/${tenantId}/`));
