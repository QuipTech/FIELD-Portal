"use client";

import { useEffect, useMemo } from "react";
import { Icon } from "@/components/icons/icon";
import { useMultiFilePicker } from "@/lib/uploads/useFilePicker";
import { MAX_PHOTOS, PHOTO_ACCEPT } from "./historyEntryDraft";

interface HistoryMediaPickerProps {
  photos: File[];
  onChange: (photos: File[]) => void;
}

// Photos chosen for the entry, previewed from the device until saved.
export const HistoryMediaPicker = ({ photos, onChange }: HistoryMediaPickerProps) => {
  const picker = useMultiFilePicker(PHOTO_ACCEPT, (files) => onChange([...photos, ...files].slice(0, MAX_PHOTOS)));
  const previews = useMemo(() => photos.map((photo) => URL.createObjectURL(photo)), [photos]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  return (
    <div className="flex flex-wrap gap-2">
      {photos.length < MAX_PHOTOS && (
        <button
          type="button"
          onClick={picker.open}
          className="flex h-[66px] w-[84px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-borderGrayStrong text-[11px] text-mutedGray hover:bg-surfaceGray"
        >
          <Icon name="camera" className="h-[22px] w-[22px]" />
          Add photo
        </button>
      )}
      {photos.map((photo, index) => (
        <div key={`${photo.name}-${index}`} className="relative">
          {photo.type === "image/heic" || photo.name.toLowerCase().endsWith(".heic") ? (
            <span className="flex h-[66px] w-[84px] flex-col items-center justify-center rounded-lg border border-borderGrayStrong bg-fillGray text-[10px] text-mutedGray">
              <Icon name="image" className="h-[22px] w-[22px]" /> HEIC
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previews[index]} alt={photo.name} className="h-[66px] w-[84px] rounded-lg border border-borderGrayStrong object-cover" />
          )}
          <button
            type="button"
            aria-label={`Remove ${photo.name}`}
            onClick={() => onChange(photos.filter((_, photoIndex) => photoIndex !== index))}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-borderGrayStrong bg-surface text-bodyGray"
          >
            <Icon name="x" className="h-3 w-3" />
          </button>
        </div>
      ))}
      {picker.input}
    </div>
  );
};
