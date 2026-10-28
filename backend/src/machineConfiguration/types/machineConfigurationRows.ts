export interface SystemRow {
  id: string;
  name: string;
}

export interface ComponentRow {
  id: string;
  system_id: string;
  system_name: string;
  name: string;
  serial_number: string | null;
  firmware_version: string | null;
  part_number: string | null;
  manufacturer: string | null;
  condition_note: string | null;
  condition_severity: string | null;
  installed_at: Date | null;
  hours_at_install: number | null;
  next_service_due_hours: number | null;
  notes: string | null;
  // The machine's current hour-meter reading.
  machine_operating_hours: number | null;
  // The component's most recent history entry, if any.
  last_entry_type: string | null;
  last_entry_at: Date | null;
  // Its most recent service or repair entry.
  last_serviced_at: Date | null;
}

export interface SnapshotRow {
  id: string;
  taken_at: Date;
  trigger: string;
  is_known_good: boolean;
  taken_by_id: string | null;
  taken_by_first_name: string | null;
  taken_by_last_name: string | null;
  taken_by_avatar_url: string | null;
}

export interface SnapshotItemRow {
  system_name: string;
  component_name: string;
  serial_number: string | null;
  firmware_version: string | null;
  software_version: string | null;
}
