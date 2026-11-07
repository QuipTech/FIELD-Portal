"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/actionMenu";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
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
import { canContributeTo, isOwnMachine } from "@/lib/machineDetail/machineAccessRules";
import type { MachineGalleryPhoto } from "@/lib/types/machine";

const arrowClasses =
  "absolute top-1/2 flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center rounded-full border border-borderGrayStrong bg-white/90 shadow-sm";

export const MachinePhotoGallery = () => {
  const { machineId, machine, service, reloadMachine, notify, notifyError } = useMachineDetail();
  const canAdd = canContributeTo(machine);
  const photos = useCachedResource(machineCacheKeys.photos(machineId), () => service.listPhotos(machineId), "Couldn't load photos.");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [deleting, setDeleting] = useState<MachineGalleryPhoto | null>(null);
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

  const deletePhoto = async (photo: MachineGalleryPhoto) => {
    await service.deletePhoto(machineId, photo.id);
    const remaining = list.filter((item) => item.id !== photo.id);
    photos.setData(remaining);
    setActiveIndex((index) => Math.min(index, Math.max(remaining.length - 1, 0)));
    reloadMachine();
    notify("Photo deleted");
  };

  const setCoverPhoto = async (photo: MachineGalleryPhoto) => {
    try {
      await service.setCoverPhoto(machineId, photo.id);
      photos.setData(list.map((item) => ({ ...item, isCover: item.id === photo.id })));
      reloadMachine();
      notify("Cover photo updated");
    } catch (error) {
      notifyError(toApiErrorMessage(error, "Couldn't set the cover photo. Please try again."));
    }
  };

  const photoActions = (photo: MachineGalleryPhoto): ActionMenuItem[] => {
    if (!isLoaded || !can(PERMISSIONS.manageMachine)) return [];
    const actions: ActionMenuItem[] = [];
    if (isOwnMachine(machine) && !photo.isCover) {
      actions.push({ label: "Set as cover", icon: "image", onSelect: () => void setCoverPhoto(photo) });
    }
    if (photo.canDelete) {
      actions.push({ label: "Delete photo", icon: "x", tone: "danger", onSelect: () => setDeleting(photo) });
    }
    return actions;
  };

  if (photos.isLoading && !photos.data) return <SkeletonBar className="h-[218px] w-[300px] flex-none rounded-lg" />;
  if (photos.error) {
    return <LoadErrorState message={photos.error} onRetry={photos.reload} className="w-[300px] flex-none rounded-lg border border-borderGray bg-surface" />;
  }

  const active = list[activeIndex];
  const step = (delta: number) => setActiveIndex((index) => (index + delta + list.length) % list.length);
  const activeActions = active ? photoActions(active) : [];

  return (
    <div className="flex w-[300px] flex-none flex-col gap-2">
      <div className="relative flex h-[168px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-borderGrayStrong bg-fillGray text-xs text-mutedGray">
        {active && active.contentType !== "image/heic" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active.url} alt={active.caption} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Icon name="image" className="h-6 w-6" />
        )}
        <span className={active ? "absolute left-2 top-2 max-w-[75%] truncate rounded bg-inkStatic/60 px-1.5 py-0.5 text-white" : undefined}>
          {active ? `Photo ${activeIndex + 1} of ${list.length} · ${active.caption}` : "No photos yet"}
        </span>
        {active?.isCover && <span className="absolute bottom-2 left-2 rounded bg-inkStatic/60 px-1.5 py-0.5 text-white">Cover</span>}
        {active && activeActions.length > 0 && (
          <span className="absolute right-2 top-2 rounded-md bg-white/90 shadow-sm">
            <ActionMenu label={`Photo ${activeIndex + 1}`} items={activeActions} />
          </span>
        )}
        {!active && canAdd && isLoaded && can(PERMISSIONS.manageMachine) && (
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
        onAddPhoto={canAdd ? picker.open : undefined}
        isUploading={isUploading}
      />
      {picker.input}
      {deleting && (
        <ConfirmDialog
          title="Delete this photo?"
          confirmLabel="Delete photo"
          onConfirm={() => deletePhoto(deleting)}
          onClose={() => setDeleting(null)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't delete the photo. Please try again.")}
        >
          <p>
            It will no longer show on this machine.
            {deleting.isCover ? " The newest remaining photo becomes the cover." : ""}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
};
