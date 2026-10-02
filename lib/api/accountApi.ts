import { apiRequest } from "./httpClient";
import { uploadMultipart } from "./multipartUpload";
import type { UploadedFile } from "../types/uploadedFile";

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  // A 15-minute signed URL for an uploaded avatar, else the Google photo.
  avatarUrl: string | null;
  // E.164 (+61412345678); where P1 alert texts go.
  phoneNumber: string | null;
}

export const getProfileRequest = (accessToken: string): Promise<UserProfile> =>
  apiRequest<UserProfile>("/users/me", { headers: { Authorization: `Bearer ${accessToken}` } });

// phoneNumber: omit to keep it, null to remove it.
export const updateProfileRequest = (
  accessToken: string,
  profile: { firstName: string; lastName: string; phoneNumber?: string | null },
): Promise<UserProfile> =>
  apiRequest<UserProfile>("/users/me", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(profile),
  });

// JPG/PNG up to 5 MB; replaces (and deletes) any previous upload.
export const uploadAvatarRequest = (
  accessToken: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<{ profile: UserProfile; file: UploadedFile }> =>
  uploadMultipart("/users/me/avatar", { accessToken, file, onProgress });

// Permanently deletes the caller's profile, sign-in and personal data
// (204). Shared asset/configuration records stay, detached from the user.
export const deleteAccountRequest = (accessToken: string): Promise<null> =>
  apiRequest<null>("/users/me", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

export interface AccountDeletionEligibility {
  canDelete: boolean;
  // Shown instead of the Delete account button, e.g. for the last Owner.
  blockedReason: string | null;
}

export const getDeletionEligibilityRequest = (accessToken: string) =>
  apiRequest<AccountDeletionEligibility>("/users/me/deletion-eligibility", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
