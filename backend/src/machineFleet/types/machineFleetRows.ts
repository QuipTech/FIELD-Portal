// Rows read by machineFleet.repository. bigint arrives from pg as a string.
export interface FleetMachineRow {
  id: string;
  label: string;
  serial_number: string;
  manufacturer_name: string;
  model_name: string;
  product_family: string | null;
  site: string | null;
  operating_hours: number | null;
  status: string;
}

export interface FeaturedDownRow extends FleetMachineRow {
  case_number: string | null;
  case_subject: string | null;
  case_priority: string | null;
}

export interface CatalogModelRow {
  manufacturer_id: string;
  manufacturer_name: string;
  model_id: string;
  model_name: string;
  product_family: string | null;
}
