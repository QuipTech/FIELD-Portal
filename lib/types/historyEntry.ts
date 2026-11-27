import type { IconName } from "@/components/icons/icon";
import type { Tone } from "@/components/ui/tone";
import type { RemoteSessionSummary } from "./remoteSession";
import type { FileTransferSummary } from "./tabletFiles";

// Entry types stored by the backend (technical_history_entries.entry_type).
// "remote_session" is written by the system when a remote session ends,
// "file_transfer" when files are sent to the machine's tablet.
export type HistoryEntryType = "repair" | "inspection" | "fault" | "service" | "note" | "remote_session" | "file_transfer";

// What a technician picks when adding an entry ("note" is API-only).
export const NEW_ENTRY_TYPES: HistoryEntryType[] = ["repair", "inspection", "fault", "service"];

// What the history can be filtered by.
export const FILTER_ENTRY_TYPES: HistoryEntryType[] = [...NEW_ENTRY_TYPES, "remote_session", "file_transfer"];

export interface HistoryPhoto {
  id: string;
  fileName: string | null;
  contentType: string | null;
  // Signed for live machines (valid 15 minutes); reload for fresh URLs.
  url: string;
}

export interface HistoryDocument {
  id: string;
  fileName: string;
  contentType: string;
  // Signed, valid 15 minutes; null until the entry is on the server.
  url: string | null;
  downloadUrl: string | null;
}

// "synced" is on the server; "saving" is an optimistic entry awaiting the
// POST; "offline" is queued on this device until the connection is back.
export type HistorySyncState = "synced" | "saving" | "offline";

export interface HistoryEntry {
  id: string;
  type: HistoryEntryType;
  occurredAt: string;
  // Null for entries captured automatically (telemetry), shown as "System".
  author: { id: string; name: string } | null;
  title: string;
  description: string;
  component: { id: string; name: string; systemName: string } | null;
  operatingHours: number | null;
  downtimeHours: number | null;
  photos: HistoryPhoto[];
  documents: HistoryDocument[];
  syncState: HistorySyncState;
  // Set on a "remote_session" entry.
  remoteSession?: RemoteSessionSummary | null;
  // Set on a "file_transfer" entry.
  fileTransfer?: FileTransferSummary | null;
}

export type HistoryDateRange = "30d" | "90d" | "365d" | "all";

// "" means any.
export interface HistoryFilters {
  type: HistoryEntryType | "";
  range: HistoryDateRange;
  authorId: string;
}

export interface HistoryQuery extends HistoryFilters {
  offset: number;
  limit: number;
}

export interface HistoryPage {
  items: HistoryEntry[];
  hasMore: boolean;
}

export interface HistoryAuthor {
  id: string;
  name: string;
}

export interface NewHistoryEntry {
  type: HistoryEntryType;
  componentId: string | null;
  // "Hydraulics › Main pump", shown while the entry is pending.
  componentLabel: string | null;
  // A repair that swapped the component; the backend then takes a
  // "Component replaced" configuration snapshot.
  componentReplaced: boolean;
  description: string;
  photos: File[];
  // Absent on entries queued offline before documents existed.
  documents?: File[];
  operatingHours: number | null;
  downtimeHours: number | null;
}

interface HistoryEntryTypeMeta {
  label: string;
  icon: IconName;
  tone: Tone;
}

export const historyEntryTypeMeta: Record<HistoryEntryType, HistoryEntryTypeMeta> = {
  repair: { label: "Repair", icon: "wrench", tone: "primary" },
  inspection: { label: "Inspection", icon: "eye", tone: "default" },
  fault: { label: "Fault", icon: "alert", tone: "amber" },
  service: { label: "Service", icon: "tool", tone: "default" },
  note: { label: "Note", icon: "file", tone: "default" },
  remote_session: { label: "Remote session", icon: "broadcast", tone: "primary" },
  file_transfer: { label: "Files to tablet", icon: "upload", tone: "default" },
};
