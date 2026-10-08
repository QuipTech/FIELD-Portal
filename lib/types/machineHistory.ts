import type { UploadedFile } from "./uploadedFile";

export type LiveHistoryEntryType = "service" | "repair" | "inspection" | "fault" | "note";

export interface MachineSummary {
  id: string;
  serialNumber: string;
  fleetNumber: string | null;
  // Asset number, else fleet number, else serial.
  label: string;
  site: string | null;
  operatingHours: number | null;
  manufacturer: string;
  model: string;
  status: string;
}

export interface MachineDetailResponse extends MachineSummary {
  hoursReadAt: string | null;
  owner: { id: string; name: string; avatarUrl: string | null } | null;
  openCaseCount: number;
}

export interface GalleryPhotoResponse {
  id: string;
  caption: string | null;
  contentType: string | null;
  uploadedAt: string;
  signedUrl: string;
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
  component: { id: string; name: string; systemName: string } | null;
  operatingHours: number | null;
  downtimeHours: number | null;
  photos: MachinePhoto[];
}

export interface MachinePhotoUploadResponse {
  photo: MachinePhoto;
  file: UploadedFile;
}
