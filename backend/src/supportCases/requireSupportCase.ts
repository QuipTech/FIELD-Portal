import { NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import {
  ACCESSIBLE_MACHINES,
  MachineScope,
} from '../machineSharing/access/machineScope';
import { findCaseByNumber } from './supportCases.repository';
import { SupportCaseRow } from './types/supportCaseRows';

const CASE_NOT_FOUND_MESSAGE = 'Support case not found.';

// A case number from another organisation, or about a machine outside the
// given machine scope, is "not found", never "forbidden". Staff paths pass
// ALL_MACHINES with the case's organisation.
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

// The customer side: a case they may see under their machine scope
// (machineSharing/access): their organisation's, or one their organisation
// raised on a machine shared with them (row.tenant_id is then the
// machine's owning organisation). Runs under withActor.
export const requireVisibleSupportCase = (
  client: PoolClient,
  actor: { tenantId: string; userId: string },
  caseNumber: number,
): Promise<SupportCaseRow> =>
  requireSupportCase(client, actor.tenantId, caseNumber, ACCESSIBLE_MACHINES);
