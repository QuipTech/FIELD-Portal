"use client";

import { Icon } from "@/components/icons/icon";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS, describeMissingPermission } from "@/lib/auth/permissionCodes";
import type { MachineGalleryPhoto } from "@/lib/types/machine";

interface GalleryThumbnailStripProps {
  photos: MachineGalleryPhoto[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAddPhoto: () => void;
  isUploading: boolean;
}

export const GalleryThumbnailStrip = ({ photos, activeIndex, onSelect, onAddPhoto, isUploading }: GalleryThumbnailStripProps) => {
  const { isLoaded, can } = usePermissions();
  const canAddPhoto = isLoaded && can(PERMISSIONS.manageMachine);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex min-w-0 gap-1.5 overflow-x-auto">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            aria-label={`Show photo ${index + 1}: ${photo.caption}`}
            onClick={() => onSelect(index)}
            className={`flex h-10 w-[52px] flex-none items-center justify-center overflow-hidden rounded-md border bg-fillGray text-mutedGray ${
              index === activeIndex ? "border-primary ring-2 ring-primaryTint" : "border-borderGrayStrong"
            }`}
          >
            {photo.contentType !== "image/heic" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <Icon name="image" className="h-3.5 w-3.5" />
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onAddPhoto}
        disabled={!canAddPhoto || isUploading}
        title={isLoaded && !canAddPhoto ? describeMissingPermission(PERMISSIONS.manageMachine) : undefined}
        className="ml-auto flex flex-none items-center gap-1 text-xs text-primary disabled:cursor-not-allowed disabled:text-mutedGray"
      >
        {isLoaded && !canAddPhoto && <Icon name="lock" className="h-3 w-3" />}
        {isUploading ? "Uploading…" : "Add photo"}
      </button>
    </div>
  );
};
