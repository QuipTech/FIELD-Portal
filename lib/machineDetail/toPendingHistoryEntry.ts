import type { HistoryEntry, HistorySyncState, NewHistoryEntry } from "@/lib/types/historyEntry";

// How an entry that isn't on the server yet shows in the timeline:
// saving (optimistic) or saved offline. Photos preview from the device.
export const toPendingHistoryEntry = (
  id: string,
  entry: NewHistoryEntry,
  syncState: Exclude<HistorySyncState, "synced">,
  occurredAt = new Date().toISOString(),
): HistoryEntry => {
  const [title, ...rest] = entry.description.split("\n");
  return {
    id,
    type: entry.type,
    occurredAt,
    author: { id: "me", name: "You" },
    title,
    description: rest.join("\n").trim(),
    component: entry.componentId && entry.componentLabel ? { id: entry.componentId, name: entry.componentLabel, systemName: "" } : null,
    operatingHours: entry.operatingHours,
    downtimeHours: entry.downtimeHours,
    photos: entry.photos.map((file, index) => ({
      id: `${id}-photo-${index}`,
      fileName: file.name,
      contentType: file.type,
      url: URL.createObjectURL(file),
    })),
    syncState,
  };
};
