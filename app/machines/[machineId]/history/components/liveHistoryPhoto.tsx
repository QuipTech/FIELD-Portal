"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS, describeMissingPermission } from "@/lib/auth/permissionCodes";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { MachinePhoto } from "@/lib/types/machineHistory";

interface LiveHistoryPhotoProps {
  photo: MachinePhoto;
  onDelete: (photoId: string) => Promise<void>;
}

// Browsers other than Safari can't draw HEIC, so those show a file tile
// that still opens the original.
const isRenderableImage = (photo: MachinePhoto) => photo.contentType !== "image/heic";

export const LiveHistoryPhoto = ({ photo, onDelete }: LiveHistoryPhotoProps) => {
  const { isLoaded, can } = usePermissions();
  const canDelete = isLoaded && can(PERMISSIONS.deleteMachinePhotos);
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <div className="relative">
      <a href={photo.signedUrl} target="_blank" rel="noreferrer" title={photo.fileName ?? "Photo"}>
        {isRenderableImage(photo) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.signedUrl} alt={photo.fileName ?? "Machine photo"} className="h-12 w-16 rounded-lg border border-borderGrayStrong object-cover" />
        ) : (
          <span className="flex h-12 w-16 flex-col items-center justify-center rounded-lg border border-borderGrayStrong bg-fillGray text-[10px] text-mutedGray">
            <Icon name="image" className="h-3.5 w-3.5" />
            HEIC
          </span>
        )}
      </a>
      <button
        type="button"
        aria-label="Delete photo"
        title={canDelete ? "Delete photo" : describeMissingPermission(PERMISSIONS.deleteMachinePhotos)}
        disabled={!canDelete}
        onClick={() => setIsConfirming(true)}
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-borderGrayStrong bg-surface text-bodyGray disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon name={canDelete ? "x" : "lock"} className="h-3 w-3" />
      </button>
      {isConfirming && (
        <ConfirmDialog
          title="Delete photo"
          confirmLabel="Delete photo"
          onConfirm={() => onDelete(photo.id)}
          onClose={() => setIsConfirming(false)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't delete the photo. Please try again.")}
        >
          The photo is removed from this history entry. It stays in the audit record, so the deletion can be traced.
        </ConfirmDialog>
      )}
    </div>
  );
};
