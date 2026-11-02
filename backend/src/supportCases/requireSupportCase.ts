import { NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { getAccessibleMachineScope } from '../machineGroups/access/getAccessibleMachineScope';
import { MachineScope } from '../machineGroups/access/machineScope';
import { findCaseByNumber } from './supportCases.repository';
import { SupportCaseRow } from './types/supportCaseRows';

const CASE_NOT_FOUND_MESSAGE = 'Support case not found.';

// A case number from another organisation, or about a machine outside the
// given machine scope, is "not found", never "forbidden". Staff paths pass
// ALL_MACHINES.
export const requireSupportCase = async (
  client: PoolClient,
  tenantId: string,
  caseNumber: number,
  scope: MachineScope,
): Promise<SupportCaseRow> => {
  const row = await findCaseByNumber(client, tenantId, caseNumber, scope);
  if (!row) throw new NotFoundException(CASE_NOT_FOUND_MESSAGE);
  return row;
};

// The customer side: a case in the caller's own organisation that they
// may see under their machine scope (machineGroups/access).
export const requireVisibleSupportCase = async (
  client: PoolClient,
  actor: { tenantId: string; userId: string },
  caseNumber: number,
): Promise<SupportCaseRow> =>
  requireSupportCase(
    client,
    actor.tenantId,
    caseNumber,
    await getAccessibleMachineScope(client, actor),
  );
