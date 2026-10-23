import type { LifecycleAction, LifecycleState } from "./machineLifecycle";

export type OperatingStatus = "running" | "down" | "service_due";

export interface FleetMachine {
  id: string;
  // Asset number, else fleet number, else serial.
  label: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  // The model's product family, e.g. "Haul truck".
  machineClass: string | null;
  site: string | null;
  operatingHours: number | null;
  status: OperatingStatus;
  // Missing from older backends, which had no lifecycle.
  lifecycleState?: LifecycleState;
  // What the caller may do next; empty without machine.lifecycle.
  availableActions?: LifecycleAction[];
}

export interface FeaturedDownMachine {
  machine: FleetMachine;
  openCase: { caseNumber: number; subject: string; priority: string } | null;
}

export interface MachineFleetList {
  items: FleetMachine[];
  // Matching the filters, across every page.
  total: number;
  page: number;
  pageSize: number;
  facets: {
    sites: string[];
    makes: { id: string; name: string }[];
    classes: string[];
  };
  featuredDown: FeaturedDownMachine | null;
}

// "" means any.
export interface MachineFleetFilters {
  site: string;
  make: string;
  status: OperatingStatus | "";
  machineClass: string;
}

export interface MachineCatalogMake {
  id: string;
  name: string;
  models: { id: string; name: string; machineClass: string | null }[];
}

export interface NewMachine {
  modelId: string;
  serialNumber: string;
  assetNumber?: string;
  site?: string;
  operatingHours?: number;
  status: OperatingStatus;
}
