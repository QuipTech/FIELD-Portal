import { MachineAccessLevel } from '../../machineSharing/access/machineAccess';
import { MachineGroupRef } from '../../machineSharing/types/machineGroupTypes';
import { MachineDocumentType } from '../dto/machineDocumentDtos';

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
  model_id: string;
  asset_number: string | null;
  operating_hours_read_at: Date | null;
  lifecycle_state: string;
  owner_id: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_avatar_url: string | null;
  photo_storage_key: string | null;
  open_case_count: number;
  groups: MachineGroupRef[];
  owning_organisation_name: string;
  access_level: MachineAccessLevel;
  is_shared: boolean;
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
  // On a shared machine, an author in another organisation (the reader
  // can't see its people, users RLS): that organisation's name.
  author_organisation_name: string | null;
  component_id: string | null;
  component_name: string | null;
  system_name: string | null;
  operating_hours: number | null;
  // numeric comes back from pg as a string.
  downtime_hours: string | null;
  // Live (not soft-deleted) photos, oldest first, as JSON from json_agg.
  photos: PhotoRow[];
  // Live documents added with the entry, oldest first, also from json_agg.
  documents: MachineDocumentRow[];
}

export interface GalleryPhotoRow extends PhotoRow {
  caption: string | null;
}

export interface MachineDocumentRow {
  id: string;
  history_entry_id: string | null;
  document_type: MachineDocumentType;
  storage_key: string;
  file_name: string;
  content_type: string;
  // bigint comes back from pg as a string.
  size_bytes: string | number;
  uploaded_by: string | null;
  created_at: Date | string;
}

export interface MachineDocumentListRow extends MachineDocumentRow {
  uploader_first_name: string | null;
  uploader_last_name: string | null;
  // An uploader in another organisation, whose people the reader can't see.
  uploader_organisation_name: string | null;
}
