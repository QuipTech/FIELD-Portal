import type { HistoryEntryType } from "./historyEntry";

export type MachineDocumentType = "service_report" | "inspection" | "certificate" | "other";

export const MACHINE_DOCUMENT_TYPES: MachineDocumentType[] = ["service_report", "inspection", "certificate", "other"];

export const machineDocumentTypeLabels: Record<MachineDocumentType, string> = {
  service_report: "Service report",
  inspection: "Inspection",
  certificate: "Certificate",
  other: "Other",
};

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
// The Documents tab also takes scans; an entry's photos have their own button.
export const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic";
export const ENTRY_DOCUMENT_ACCEPT = ".pdf,.doc,.docx";

export interface MachineDocumentFile {
  id: string;
  historyEntryId: string | null;
  documentType: MachineDocumentType;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  // Both valid 15 minutes; reload the list for fresh ones. signedUrl opens the
  // file in the browser where it can, downloadUrl saves it.
  signedUrl: string;
  downloadUrl: string;
}

export interface MachineDocument extends MachineDocumentFile {
  // Null once the uploader's account has been deleted.
  uploadedByName: string | null;
  // The owning organisation can delete any file; a share only its own uploads.
  canDelete: boolean;
}

// What a file added with a history entry is filed as.
export const documentTypeForEntry = (entryType: HistoryEntryType): MachineDocumentType => {
  if (entryType === "service") return "service_report";
  if (entryType === "inspection") return "inspection";
  return "other";
};
