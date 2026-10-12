import type { OperatingStatus } from "./machineFleet";

export type MachineStatus = "running" | "down" | "serviceDue";

export interface MachinePerson {
  id: string;
  name: string;
  avatarUrl: string | null;
}

// One machine as the detail screens show it (GET /machines/:id).
export interface Machine {
  id: string;
  // What people call the machine: asset number, else fleet, else serial.
  assetId: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  status: OperatingStatus;
  operatingHours: number | null;
  hoursReadAt: string | null;
  site: string | null;
  // Whoever registered the machine.
  owner: MachinePerson | null;
  // Open or in-progress support cases about the machine.
  openCaseCount: number;
}

export interface MachineGalleryPhoto {
  id: string;
  caption: string;
  contentType: string | null;
  // Signed, valid 15 minutes; reload the gallery for fresh URLs.
  url: string;
}
