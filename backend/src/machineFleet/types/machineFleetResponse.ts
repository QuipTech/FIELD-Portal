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
  status: OperatingStatus;
}

export interface FeaturedDownMachine {
  machine: FleetMachine;
  // Its most urgent open support case, if one is raised.
  openCase: { caseNumber: number; subject: string; priority: string } | null;
}

export interface MachineFleetList {
  items: FleetMachine[];
  // Matching the filters (items stops at the page limit).
  total: number;
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
