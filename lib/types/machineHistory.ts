import type { UploadedFile } from "./uploadedFile";

export type LiveHistoryEntryType = "service" | "repair" | "inspection" | "fault" | "note";

export interface MachineSummary {
  id: string;
  serialNumber: string;
  fleetNumber: string | null;
  manufacturer: string;
  model: string;
  status: string;
}

export interface MachinePhoto {
  id: string;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  // Valid 15 minutes; reload the history for fresh URLs.
  signedUrl: string;
}

export interface LiveHistoryEntry {
  id: string;
  entryType: LiveHistoryEntryType;
  description: string;
  isAmendment: boolean;
  createdAt: string;
  author: { id: string; name: string } | null;
  photos: MachinePhoto[];
}

export interface MachinePhotoUploadResponse {
  photo: MachinePhoto;
  file: UploadedFile;
}
