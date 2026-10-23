import { AssignedTechnicianRow } from './machineAssignments.repository';

export interface AssignedTechnician {
  id: string;
  name: string;
  avatarUrl: string | null;
  assignedAt: string;
}

export const toAssignedTechnician = (
  row: AssignedTechnicianRow,
): AssignedTechnician => ({
  id: row.id,
  name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
  avatarUrl: row.avatar_url,
  assignedAt: row.assigned_at.toISOString(),
});
