import {
  LifecycleAction,
  LifecycleState,
} from '../../machineLifecycle/lifecycleTransitions';

export const OPERATING_STATUSES = ['running', 'down', 'service_due'] as const;
export type OperatingStatus = (typeof OPERATING_STATUSES)[number];

export interface FleetMachine {
  id: string;
  // What people call the machine: asset number, else fleet, else serial.
  label: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  // The model's product family, e.g. "Haul truck".
  machineClass: string | null;
  site: string | null;
  operatingHours: number | null;
  // Signed for 15 minutes: the cover photo, else the newest gallery photo.
  photoUrl: string | null;
  status: OperatingStatus;
  // Billing lifecycle: only active machines are billed and show full
  // history.
  lifecycleState: LifecycleState;
  // What the caller may do next (empty without machine.lifecycle).
  availableActions: LifecycleAction[];
  canRequestTransfer: boolean;
}

export interface FeaturedDownMachine {
  machine: FleetMachine;
  // Its most urgent open support case, if one is raised.
  openCase: { caseNumber: number; subject: string; priority: string } | null;
}

export interface MachineFleetList {
  items: FleetMachine[];
  // Matching the filters, across every page.
  total: number;
  page: number;
  pageSize: number;
  // Choices for the filter panel, from the organisation's whole fleet.
  facets: {
    sites: string[];
    makes: { id: string; name: string }[];
    classes: string[];
  };
  // A down machine to flag above the list, ignoring the filters.
  featuredDown: FeaturedDownMachine | null;
}

export interface MachineCatalogMake {
  id: string;
  name: string;
  models: { id: string; name: string; machineClass: string | null }[];
}
