"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { useCachedResource } from "@/lib/machineDetail/useCachedResource";
import { machineCacheKeys } from "@/lib/machineDetail/machineDetailCacheKeys";
import { useFilePicker } from "@/lib/uploads/useFilePicker";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { useMachineDetail } from "../machineDetailContext";
import { GalleryThumbnailStrip } from "./galleryThumbnailStrip";

const arrowClasses =
  "absolute top-1/2 flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center rounded-full border border-borderGrayStrong bg-white/90 shadow-sm";

export const MachinePhotoGallery = () => {
  const { machineId, service, notify, notifyError } = useMachineDetail();
  const photos = useCachedResource(machineCacheKeys.photos(machineId), () => service.listPhotos(machineId), "Couldn't load photos.");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const { isLoaded, can } = usePermissions();
  const list = photos.data ?? [];

  const uploadPhoto = async (file: File) => {
    setIsUploading(true);
    try {
      const uploaded = await service.uploadPhoto(machineId, file);
      photos.setData([...list, uploaded]);
      setActiveIndex(list.length);
      notify("Photo added");
    } catch (error) {
      notifyError(toApiErrorMessage(error, "Couldn't upload the photo. Please try again."));
    } finally {
      setIsUploading(false);
    }
  };
  const picker = useFilePicker(".jpg,.jpeg,.png,.heic", uploadPhoto);

  if (photos.isLoading && !photos.data) return <SkeletonBar className="h-[218px] w-[300px] flex-none rounded-lg" />;
  if (photos.error) {
    return <LoadErrorState message={photos.error} onRetry={photos.reload} className="w-[300px] flex-none rounded-lg border border-borderGray bg-surface" />;
  }

  const active = list[activeIndex];
  const step = (delta: number) => setActiveIndex((index) => (index + delta + list.length) % list.length);

  return (
    <div className="flex w-[300px] flex-none flex-col gap-2">
      <div className="relative flex h-[168px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-borderGrayStrong bg-fillGray text-xs text-mutedGray">
        {active && active.contentType !== "image/heic" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active.url} alt={active.caption} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Icon name="image" className="h-6 w-6" />
        )}
        <span className={active ? "absolute left-2 top-2 max-w-[90%] truncate rounded bg-inkStatic/60 px-1.5 py-0.5 text-white" : undefined}>
          {active ? `Photo ${activeIndex + 1} of ${list.length} · ${active.caption}` : "No photos yet"}
        </span>
        {!active && isLoaded && can(PERMISSIONS.manageMachine) && (
          <button type="button" onClick={picker.open} disabled={isUploading} className="text-xs font-medium text-primary disabled:opacity-50">
            {isUploading ? "Uploading…" : "Add the first photo"}
          </button>
        )}
        {list.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className={`${arrowClasses} left-2`}>
              <Icon name="chevl" />
            </button>
            <button type="button" aria-label="Next photo" onClick={() => step(1)} className={`${arrowClasses} right-2`}>
              <Icon name="chevr" />
            </button>
            <span className="absolute bottom-2.5 flex items-center gap-1.5">
              {list.map((photo, index) => (
                <span key={photo.id} className={`h-1.5 w-1.5 rounded-full ${index === activeIndex ? "bg-primary" : "bg-inkStatic/20"}`} />
              ))}
            </span>
          </>
        )}
      </div>
      <GalleryThumbnailStrip
        photos={list}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        onAddPhoto={picker.open}
        isUploading={isUploading}
      />
      {picker.input}
    </div>
  );
};
