"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { formatDayMonth } from "@/lib/format/elapsedTimeLabel";
import { historyEntryTypeMeta, type HistoryEntry, type HistoryPhoto, type HistorySyncState } from "@/lib/types/historyEntry";
import { HistoryPhotoLightbox } from "./historyPhotoLightbox";

interface HistoryTimelineEntryProps {
  entry: HistoryEntry;
  onDeletePhoto: (entryId: string, photoId: string) => Promise<void>;
}

// "Hydraulics › Main pump · 14,208 h · 3.5 h downtime".
const describeEntryDetails = (entry: HistoryEntry): string =>
  [
    entry.component && [entry.component.systemName, entry.component.name].filter(Boolean).join(" › "),
    entry.operatingHours !== null && `${entry.operatingHours.toLocaleString()} h`,
    entry.downtimeHours !== null && `${entry.downtimeHours} h downtime`,
  ]
    .filter(Boolean)
    .join(" · ");

const syncStateLabels: Record<HistorySyncState, string> = {
  synced: "Saved",
  saving: "Saving…",
  offline: "Saved offline — syncs when back in range",
};

export const HistoryTimelineEntry = ({ entry, onDeletePhoto }: HistoryTimelineEntryProps) => {
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<HistoryPhoto | null>(null);
  const meta = historyEntryTypeMeta[entry.type];
  const isSynced = entry.syncState === "synced";

  return (
    <article className={`relative flex flex-col gap-2 border-b border-borderGray py-3.5 last:border-b-0 ${isSynced ? "" : "opacity-80"}`}>
      <span aria-hidden className="absolute -left-[23px] top-[19px] h-2 w-2 rounded-full border-2 border-surface bg-borderGrayStrong" />
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={meta.tone}>
          <Icon name={meta.icon} className="h-3.5 w-3.5" />
          {meta.label}
        </Tag>
        {!isSynced && (
          <Tag tone={entry.syncState === "offline" ? "amber" : "default"}>
            <Icon name={entry.syncState === "offline" ? "cloud" : "clock"} className="h-3.5 w-3.5" />
            {syncStateLabels[entry.syncState]}
          </Tag>
        )}
        <span className="ml-auto text-xs text-mutedGray">
          {formatDayMonth(new Date(entry.occurredAt))} · {entry.author?.name ?? "System"}
        </span>
      </div>
      <h3 className="text-[15px] font-medium text-ink">{entry.title}</h3>
      {entry.description && <p className="whitespace-pre-line text-xs text-mutedGray">{entry.description}</p>}
      {describeEntryDetails(entry) && <span className="text-xs text-bodyGray">{describeEntryDetails(entry)}</span>}
      {entry.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entry.photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              aria-label={`Open photo ${index + 1}`}
              onClick={() => setPhotoIndex(index)}
              className="flex h-12 w-16 items-center justify-center overflow-hidden rounded-lg border border-borderGrayStrong bg-fillGray text-mutedGray"
            >
              {photo.contentType === "image/heic" ? (
                <Icon name="image" className="h-3.5 w-3.5" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
      {photoIndex !== null && (
        <HistoryPhotoLightbox
          photos={entry.photos}
          index={photoIndex}
          onIndexChange={setPhotoIndex}
          onClose={() => setPhotoIndex(null)}
          onDelete={isSynced ? setPhotoToDelete : undefined}
        />
      )}
      {photoToDelete && (
        <ConfirmDialog
          title="Delete photo"
          confirmLabel="Delete photo"
          onConfirm={async () => {
            await onDeletePhoto(entry.id, photoToDelete.id);
            setPhotoIndex(null);
          }}
          onClose={() => setPhotoToDelete(null)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't delete the photo. Please try again.")}
        >
          The photo is removed from this history entry. It stays in the audit record, so the deletion can be traced.
        </ConfirmDialog>
      )}
    </article>
  );
};
