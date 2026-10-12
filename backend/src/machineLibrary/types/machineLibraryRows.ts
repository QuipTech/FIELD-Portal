// One row of admin_list_machine_models() (migration 0040).
export interface MachineModelRow {
  id: string;
  manufacturer_name: string;
  name: string;
  product_family: string | null;
  // NULL for the shared catalog; otherwise the organisation it belongs to.
  tenant_id: string | null;
  organisation_name: string | null;
  // bigint arrives from pg as a string.
  systems_count: string;
  assets_count: string;
}

// One system joined with one of its components; component_* are null for
// a system with no components yet.
export interface ModelTreeRow {
  system_id: string;
  system_name: string;
  component_id: string | null;
  component_name: string | null;
}
