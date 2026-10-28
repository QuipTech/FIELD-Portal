import { LifecycleState } from '../../machineLifecycle/lifecycleTransitions';
import { AssignedTechnician } from '../../machineAssignments/assignedTechnicianMapper';

export interface MachineSummary {
  id: string;
  serialNumber: string;
  fleetNumber: string | null;
  // What people call the machine: asset number, else fleet, else serial.
  label: string;
  site: string | null;
  operatingHours: number | null;
  manufacturer: string;
  model: string;
  status: string;
}

export interface MachineDetail extends MachineSummary {
  // The machine model's id, e.g. to find its manuals in the knowledge library.
  modelId: string;
  // The customer's Plant ID / asset number, exactly as entered.
  plantId: string | null;
  hoursReadAt: string | null;
  // registered / active / archived / sold. Anything but active shows
  // identity and summary only.
  lifecycleState: LifecycleState;
  // Whoever registered the machine.
  owner: { id: string; name: string; avatarUrl: string | null } | null;
  // Open or in-progress support cases about the machine.
  openCaseCount: number;
  // Signed for 15 minutes: the cover photo, else the newest gallery photo.
  photoUrl: string | null;
  assignedTechnicians: AssignedTechnician[];
}

export interface MachinePhoto {
  id: string;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  // Signed on read, valid 15 minutes; the database only holds the key.
  signedUrl: string;
}

export interface HistoryEntry {
  id: string;
  entryType: string;
  description: string;
  isAmendment: boolean;
  createdAt: string;
  // Null once the author's account has been deleted.
  author: { id: string; name: string } | null;
  // The installed component the entry is about, if one was named.
  component: { id: string; name: string; systemName: string } | null;
  operatingHours: number | null;
  downtimeHours: number | null;
  photos: MachinePhoto[];
}

export interface GalleryPhoto {
  id: string;
  caption: string | null;
  contentType: string | null;
  uploadedAt: string;
  // Signed on read, valid 15 minutes.
  signedUrl: string;
}
