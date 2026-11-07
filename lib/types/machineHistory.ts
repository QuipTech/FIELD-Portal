import type { UploadedFile } from "./uploadedFile";
import type { LifecycleState } from "./machineLifecycle";
import type { MachineSharing } from "./machineGroup";
import type { MachineDocumentFile } from "./machineDocument";

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
  // Missing from older backends.
  modelId?: string;
  plantId: string | null;
  hoursReadAt: string | null;
  owner: { id: string; name: string; avatarUrl: string | null } | null;
  openCaseCount: number;
  // Missing from older backends, which had no lifecycle.
  lifecycleState?: LifecycleState;
  // Missing from older backends, which had no sharing.
  groups?: MachineSharing["groups"];
  owningOrganisationName?: string;
  isShared?: boolean;
  accessLevel?: MachineSharing["accessLevel"];
}

export interface GalleryPhotoResponse {
  id: string;
  caption: string | null;
  contentType: string | null;
  uploadedAt: string;
  signedUrl: string;
  canDelete: boolean;
  isCover: boolean;
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
  // Missing from older backends, which had no machine documents.
  documents?: MachineDocumentFile[];
}

export interface MachinePhotoUploadResponse {
  photo: MachinePhoto;
  file: UploadedFile;
}
