export interface MachineRow {
  id: string;
  serial_number: string;
  fleet_number: string | null;
  // Asset number, else fleet number, else serial (see MACHINE_LABEL_SQL).
  label: string;
  site: string | null;
  operating_hours: number | null;
  status: string;
  manufacturer_name: string;
  model_name: string;
}

export interface MachineDetailRow extends MachineRow {
  operating_hours_read_at: Date | null;
  owner_id: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_avatar_url: string | null;
  open_case_count: number;
}

export interface PhotoRow {
  id: string;
  storage_key: string;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface HistoryEntryRow {
  id: string;
  entry_type: string;
  description: string;
  is_amendment: boolean;
  created_at: Date;
  author_id: string | null;
  author_first_name: string | null;
  author_last_name: string | null;
  component_id: string | null;
  component_name: string | null;
  system_name: string | null;
  operating_hours: number | null;
  // numeric comes back from pg as a string.
  downtime_hours: string | null;
  // Live (not soft-deleted) photos, oldest first, as JSON from json_agg.
  photos: PhotoRow[];
}

export interface GalleryPhotoRow extends PhotoRow {
  caption: string | null;
}
