import type { HistoryEntry } from "@/lib/types/historyEntry";

// Fired on window when an offline-queued entry reaches the server, so an
// open timeline swaps its placeholder for the saved entry.
export const HISTORY_SYNCED_EVENT = "field:historyEntrySynced";

export interface HistorySyncedDetail {
  queuedId: string;
  entry: HistoryEntry;
}

export const announceHistorySynced = (detail: HistorySyncedDetail): void => {
  window.dispatchEvent(new CustomEvent<HistorySyncedDetail>(HISTORY_SYNCED_EVENT, { detail }));
};
