import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import { IncomingFile, UploadedFile } from '../storage/types/storedFile';
import * as userProfileRepository from './userProfile.repository';
import { UserProfileRow } from './userProfile.repository';
import { resolveAvatarUrl } from './resolveAvatarUrl';
import { UpdateProfileDto } from './dto/updateProfileDto';

const ACCOUNT_NOT_FOUND_MESSAGE = 'Account not found.';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  updateProfile = async (
    actor: AuthenticatedUser,
    dto: UpdateProfileDto,
  ): Promise<UserProfile> => {
    const row = await this.databaseService.withTenant(
      actor.tenantId,
      (client) =>
        userProfileRepository.updateUserName(client, {
          userId: actor.userId,
          tenantId: actor.tenantId,
          ...dto,
        }),
    );
    return this.toProfile(this.assertFound(row));
  };

  // New avatar first, then the database; only once both succeed is the
  // previous object deleted — e.g. old .png when a .jpg arrives, which a
  // plain overwrite (same key only when extensions match) would orphan.
  uploadAvatar = async (
    actor: AuthenticatedUser,
    file: IncomingFile | undefined,
  ): Promise<{ profile: UserProfile; file: UploadedFile }> => {
    const scope = { userId: actor.userId, tenantId: actor.tenantId };
    const current = this.assertFound(
      await this.databaseService.withTenant(actor.tenantId, (client) =>
        userProfileRepository.findUserProfile(client, scope),
      ),
    );
    const stored = await this.storageService.uploadAvatar(
      file,
      actor.tenantId,
      actor.userId,
    );
    const updated = this.assertFound(
      await this.databaseService.withTenant(actor.tenantId, (client) =>
        userProfileRepository.setAvatarStorageKey(client, {
          ...scope,
          key: stored.key,
        }),
      ),
    );
    const previousKey = current.avatar_storage_key;
    if (previousKey && previousKey !== stored.key) {
      await this.storageService
        .deleteFile(previousKey, actor.tenantId)
        .catch((error: unknown) =>
          this.logger.warn(
            `Couldn't delete old avatar ${previousKey}: ${String(error)}`,
          ),
        );
    }
    const profile = await this.toProfile(updated);
    return {
      profile,
      file: {
        key: stored.key,
        signedUrl: profile.avatarUrl ?? '',
        uploadedAt: stored.uploadedAt,
      },
    };
  };

  private assertFound = (row: UserProfileRow | null): UserProfileRow => {
    if (!row) throw new NotFoundException(ACCOUNT_NOT_FOUND_MESSAGE);
    return row;
  };

  private toProfile = async (row: UserProfileRow): Promise<UserProfile> => ({
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: await resolveAvatarUrl(this.storageService, row),
  });
}
