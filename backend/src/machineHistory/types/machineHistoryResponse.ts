export interface MachineSummary {
  id: string;
  serialNumber: string;
  fleetNumber: string | null;
  // What people call the machine: asset number, else fleet, else serial.
  label: string;
  site: string | null;
  operatingHours: number | null;
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
  // Signed on read, valid 15 minutes; the database only holds the key.
  signedUrl: string;
}

export interface HistoryEntry {
  id: string;
  entryType: string;
  description: string;
  isAmendment: boolean;
  createdAt: string;
  // Null once the author's account has been deleted.
  author: { id: string; name: string } | null;
  photos: MachinePhoto[];
}
