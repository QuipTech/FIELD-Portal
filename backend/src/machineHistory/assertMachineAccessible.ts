import { NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import * as machineHistoryRepository from './machineHistory.repository';
import { MachineRow } from './types/machineHistoryRows';
import {
  MachineAccessGrant,
  MachineAccessNeed,
  requireMachineAccess,
} from '../machineSharing/access/machineAccess';

export const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';

// Throws 404 unless the machine is in the caller's machine scope
// (machineSharing/access): theirs, or shared with them. `need` 'contribute'
// refuses a view-only share (403); 'manage' refuses any shared machine
// (404). access.tenantId is the OWNING organisation, where the machine's
// rows live. Runs under withActor (the scope needs app.user_id).
export const assertMachineAccessible = async (
  client: PoolClient,
  machineId: string,
  need: MachineAccessNeed = 'read',
): Promise<MachineRow & { access: MachineAccessGrant }> => {
  const access = await requireMachineAccess(client, machineId, need);
  const machine = await machineHistoryRepository.findMachine(
    client,
    access.tenantId,
    machineId,
  );
  if (!machine) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
  return { ...machine, access };
};
