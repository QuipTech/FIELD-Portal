"use client";

import { Icon } from "@/components/icons/icon";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS, describeMissingPermission } from "@/lib/auth/permissionCodes";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { uploadMachinePhotoRequest } from "@/lib/api/machineHistoryApi";
import { useFileUpload } from "@/lib/uploads/useFileUpload";
import { useFilePicker } from "@/lib/uploads/useFilePicker";
import type { MachinePhoto } from "@/lib/types/machineHistory";
import { UploadProgressBar } from "./uploadProgressBar";

interface MachinePhotoUploaderProps {
  machineId: string;
  entryId: string;
  onUploaded: (photo: MachinePhoto) => void;
}

// Adds a JPG/PNG/HEIC photo (≤ 10 MB) to one technical history entry.
// Needs the "Add history entries" permission.
export const MachinePhotoUploader = ({ machineId, entryId, onUploaded }: MachinePhotoUploaderProps) => {
  const { isLoaded, can } = usePermissions();
  const isAllowed = isLoaded && can(PERMISSIONS.addHistoryEntry);
  const { upload, progress, isUploading, errorMessage } = useFileUpload((file, onProgress) =>
    uploadMachinePhotoRequest(requireAccessToken(), { machineId, entryId }, file, onProgress),
  );
  const picker = useFilePicker(".jpg,.jpeg,.png,.heic", async (file) => {
    const result = await upload(file);
    if (result) onUploaded(result.photo);
  });

  return (
    <div className="flex flex-col gap-1" title={isLoaded && !isAllowed ? describeMissingPermission(PERMISSIONS.addHistoryEntry) : undefined}>
      <button
        type="button"
        onClick={picker.open}
        disabled={!isAllowed || isUploading}
        className="flex h-12 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-borderGrayStrong text-[10px] text-mutedGray disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name={isLoaded && !isAllowed ? "lock" : "camera"} className="h-3.5 w-3.5" />
        {isUploading ? `${Math.round((progress ?? 0) * 100)}%` : "Add photo"}
      </button>
      {picker.input}
      {isUploading && <UploadProgressBar fraction={progress ?? 0} className="w-16" />}
      {errorMessage && <span className="max-w-[220px] text-xs text-danger">{errorMessage}</span>}
    </div>
  );
};
