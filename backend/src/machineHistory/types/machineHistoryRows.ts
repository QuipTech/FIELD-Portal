export interface MachineRow {
  id: string;
  serial_number: string;
  fleet_number: string | null;
  status: string;
  manufacturer_name: string;
  model_name: string;
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
  // Live (not soft-deleted) photos, oldest first, as JSON from json_agg.
  photos: PhotoRow[];
}
