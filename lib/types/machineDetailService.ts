import type { Machine, MachineGalleryPhoto } from "./machine";
import type { MachineComponent, MachineSystem } from "./machineComponent";
import type { DiffExportFormat, Snapshot, SnapshotDiff } from "./configurationDiff";
import type { OperatingStatus } from "./machineFleet";
import type { HistoryAuthor, HistoryEntry, HistoryPage, HistoryQuery, NewHistoryEntry } from "./historyEntry";

// Everything the machine detail screens read and write (see
// lib/api/machineDetail/machineDetailService.ts).
export interface MachineDetailService {
  getMachine: (machineId: string) => Promise<Machine>;
  updateStatus: (machineId: string, status: OperatingStatus) => Promise<OperatingStatus>;
  listPhotos: (machineId: string) => Promise<MachineGalleryPhoto[]>;
  uploadPhoto: (machineId: string, file: File) => Promise<MachineGalleryPhoto>;
  listSystems: (machineId: string) => Promise<MachineSystem[]>;
  // All components when systemId is null.
  listComponents: (machineId: string, systemId: string | null) => Promise<MachineComponent[]>;
  listSnapshots: (machineId: string) => Promise<Snapshot[]>;
  takeSnapshot: (machineId: string) => Promise<Snapshot>;
  setSnapshotKnownGood: (machineId: string, snapshotId: string, isKnownGood: boolean) => Promise<Snapshot>;
  getSnapshotDiff: (machineId: string, fromId: string, toId: string) => Promise<SnapshotDiff>;
  exportSnapshotDiff: (machineId: string, fromId: string, toId: string, format: DiffExportFormat) => Promise<Blob>;
  listHistory: (machineId: string, query: HistoryQuery) => Promise<HistoryPage>;
  listHistoryAuthors: (machineId: string) => Promise<HistoryAuthor[]>;
  createHistoryEntry: (machineId: string, entry: NewHistoryEntry) => Promise<HistoryEntry>;
  deleteHistoryPhoto: (machineId: string, entryId: string, photoId: string) => Promise<void>;
}
