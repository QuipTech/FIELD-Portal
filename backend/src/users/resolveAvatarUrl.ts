import { StorageService } from '../storage/storage.service';

interface AvatarSource {
  avatar_url: string | null;
  avatar_storage_key: string | null;
}

// An uploaded avatar (S3 key → 15-minute signed URL) wins over the Google
// photo URL. If signing fails (e.g. storage not configured) sign-in still
// works, just with the Google photo or none.
export const resolveAvatarUrl = async (
  storageService: StorageService,
  user: AvatarSource,
): Promise<string | null> => {
  if (!user.avatar_storage_key) return user.avatar_url;
  try {
    return (await storageService.getSignedDownloadUrl(user.avatar_storage_key))
      .url;
  } catch {
    return user.avatar_url;
  }
};
