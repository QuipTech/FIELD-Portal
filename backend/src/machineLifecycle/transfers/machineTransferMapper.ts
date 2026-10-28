import {
  MachineSummary,
  TransferRow,
  TransferStatus,
} from './machineTransfers.repository';

export interface MachineTransfer {
  id: string;
  machineId: string;
  machine: MachineSummary;
  fromOrganisation: { id: string; name: string };
  toOrganisation: { id: string; name: string };
  status: TransferStatus;
  reason: string;
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
}

export const toMachineTransfer = (row: TransferRow): MachineTransfer => ({
  id: row.id,
  machineId: row.machine_id,
  machine: row.machine_summary,
  fromOrganisation: { id: row.from_tenant_id, name: row.from_tenant_name },
  toOrganisation: { id: row.to_tenant_id, name: row.to_tenant_name },
  status: row.status,
  reason: row.reason,
  requestedAt: row.requested_at.toISOString(),
  decidedAt: row.decided_at?.toISOString() ?? null,
  decisionNote: row.decision_note,
});
