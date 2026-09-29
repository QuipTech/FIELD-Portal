"use client";

import { Icon } from "@/components/icons/icon";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { uploadAvatarRequest, type UserProfile } from "@/lib/api/accountApi";
import { useFileUpload } from "@/lib/uploads/useFileUpload";
import { useFilePicker } from "@/lib/uploads/useFilePicker";
import { UploadProgressBar } from "./uploadProgressBar";

interface AvatarUploaderProps {
  initials: string;
  avatarUrl?: string;
  onUploaded: (profile: UserProfile) => void;
}

// Uploads the signed-in user's avatar (JPG/PNG, ≤ 5 MB) straight away via
// POST /users/me/avatar; the backend replaces and deletes the old one.
export const AvatarUploader = ({ initials, avatarUrl, onUploaded }: AvatarUploaderProps) => {
  const { upload, progress, isUploading, errorMessage } = useFileUpload((file, onProgress) =>
    uploadAvatarRequest(requireAccessToken(), file, onProgress),
  );
  const picker = useFilePicker(".jpg,.jpeg,.png", async (file) => {
    const result = await upload(file);
    if (result) onUploaded(result.profile);
  });

  return (
    <div className="flex items-center gap-3.5">
      <Avatar initials={initials} imageSrc={avatarUrl} size="lg" />
      <div className="flex flex-col gap-1">
        <Button size="sm" onClick={picker.open} disabled={isUploading}>
          <Icon name="camera" />
          {isUploading ? `Uploading ${Math.round((progress ?? 0) * 100)}%` : "Change photo"}
        </Button>
        {isUploading ? (
          <UploadProgressBar fraction={progress ?? 0} />
        ) : (
          <span className="text-xs text-mutedGray">PNG or JPG, up to 5MB</span>
        )}
        {errorMessage && <span className="text-xs text-danger">{errorMessage}</span>}
      </div>
      {picker.input}
    </div>
  );
};
