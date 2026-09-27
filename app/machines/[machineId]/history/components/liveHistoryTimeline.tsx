import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { MachinePhotoUploader } from "@/components/uploads/machinePhotoUploader";
import { liveHistoryEntryTypes } from "@/lib/types/historyEntry";
import type { LiveHistoryEntry, MachinePhoto } from "@/lib/types/machineHistory";
import { LiveHistoryPhoto } from "./liveHistoryPhoto";

interface LiveHistoryTimelineProps {
  machineId: string;
  entries: LiveHistoryEntry[];
  onPhotoAdded: (entryId: string, photo: MachinePhoto) => void;
  onPhotoDeleted: (entryId: string, photoId: string) => Promise<void>;
}

// "02 Mar 2026 · 09:40"
const formatEntryDate = (isoDate: string) => {
  const date = new Date(isoDate);
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

export const LiveHistoryTimeline = ({ machineId, entries, onPhotoAdded, onPhotoDeleted }: LiveHistoryTimelineProps) => {
  if (entries.length === 0) {
    return <span className="p-5 text-sm text-mutedGray">No history yet. Add the first entry.</span>;
  }

  return (
    <div className="ml-2 flex flex-1 flex-col border-l border-borderGrayStrong pl-[18px]">
      {entries.map((entry) => {
        const meta = liveHistoryEntryTypes[entry.entryType];
        return (
          <div key={entry.id} className="flex flex-col gap-2 border-b border-borderGray py-3.5 last:border-b-0">
            <div className="flex items-center">
              <Tag tone={meta.tone}>
                <Icon name={meta.icon} className="h-3.5 w-3.5" />
                {meta.label}
              </Tag>
              <span className="ml-auto text-xs text-mutedGray">
                {entry.author?.name ?? "Deleted user"} · {formatEntryDate(entry.createdAt)}
              </span>
            </div>
            <span className="whitespace-pre-line text-[15px] text-ink">{entry.description}</span>
            <div className="flex flex-wrap items-start gap-2">
              {entry.photos.map((photo) => (
                <LiveHistoryPhoto key={photo.id} photo={photo} onDelete={(photoId) => onPhotoDeleted(entry.id, photoId)} />
              ))}
              <MachinePhotoUploader
                machineId={machineId}
                entryId={entry.id}
                onUploaded={(photo) => onPhotoAdded(entry.id, photo)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
