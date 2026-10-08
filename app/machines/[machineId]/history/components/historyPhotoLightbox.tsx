"use client";

import { useEffect } from "react";
import { Icon } from "@/components/icons/icon";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import type { HistoryPhoto } from "@/lib/types/historyEntry";

interface HistoryPhotoLightboxProps {
  photos: HistoryPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  // Omitted for entries that aren't on the server yet.
  onDelete?: (photo: HistoryPhoto) => void;
}

// Browsers other than Safari can't draw HEIC; those open the original.
const isRenderable = (photo: HistoryPhoto) => photo.contentType !== "image/heic";

export const HistoryPhotoLightbox = ({ photos, index, onIndexChange, onClose, onDelete }: HistoryPhotoLightboxProps) => {
  const photo = photos[index];
  const step = (delta: number) => onIndexChange((index + delta + photos.length) % photos.length);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onIndexChange((index - 1 + photos.length) % photos.length);
      if (event.key === "ArrowRight") onIndexChange((index + 1) % photos.length);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [index, photos.length, onClose, onIndexChange]);

  if (!photo) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo" className="fixed inset-0 z-40 flex flex-col bg-inkStatic/90 p-4" onClick={onClose}>
      <div className="flex items-center gap-2 text-sm text-white" onClick={(event) => event.stopPropagation()}>
        <span>Photo {index + 1} of {photos.length}{photo.fileName ? ` · ${photo.fileName}` : ""}</span>
        {onDelete && (
          <PermissionButton permission={PERMISSIONS.deleteMachinePhotos} size="sm" variant="danger" className="ml-auto" onClick={() => onDelete(photo)}>
            Delete photo
          </PermissionButton>
        )}
        <button type="button" aria-label="Close" onClick={onClose} className={onDelete ? "" : "ml-auto"}>
          <Icon name="x" className="stroke-white" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center" onClick={(event) => event.stopPropagation()}>
        {isRenderable(photo) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={photo.fileName ?? "History photo"} className="max-h-full max-w-full rounded-lg object-contain" />
        ) : (
          <a href={photo.url} target="_blank" rel="noreferrer" className="text-white underline">Open HEIC photo</a>
        )}
        {photos.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className="absolute left-2 rounded-full bg-white/90 p-2">
              <Icon name="chevl" />
            </button>
            <button type="button" aria-label="Next photo" onClick={() => step(1)} className="absolute right-2 rounded-full bg-white/90 p-2">
              <Icon name="chevr" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
