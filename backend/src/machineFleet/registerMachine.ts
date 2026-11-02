import { BadRequestException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { findUserPermissionCodes } from '../auth/userAccess.repository';
import { getAccessibleMachineScope } from '../machineGroups/access/getAccessibleMachineScope';
import {
  isMachineAccessAdmin,
  MachineScope,
} from '../machineGroups/access/machineScope';
import { resolveNewMachineGroup } from '../machineGroups/access/newMachineGroupRule';
import { findLiveGroups } from '../machineGroups/machineGroups.repository';
import { GROUP_NOT_FOUND_MESSAGE } from '../machineGroups/moveMachinesToGroup';
import * as catalogRepository from './machineCatalog.repository';
import { OperatingStatus } from './types/machineFleetResponse';

export const UNKNOWN_MODEL_MESSAGE =
  'That model is not in the Machine library. Pick another, or ask your QuipTech admin to add it.';

export interface NewMachine {
  modelId: string;
  serialNumber: string;
  assetNumber: string | null;
  site: string | null;
  operatingHours: number | null;
  status: OperatingStatus;
  groupId: string | null;
}

// Who is registering: their machine scope and whether they're an admin
// decide which group a new machine may go in (newMachineGroupRule).
export interface Registrar {
  tenantId: string;
  userId: string;
  scope: MachineScope;
  isAdmin: boolean;
}

export const loadRegistrar = async (
  client: PoolClient,
  actor: { tenantId: string; userId: string },
): Promise<Registrar> => ({
  ...actor,
  scope: await getAccessibleMachineScope(client, actor),
  isAdmin: isMachineAccessAdmin(
    await findUserPermissionCodes(client, actor.userId),
  ),
});

// Saves one machine against a Machine library model, in the caller's
// transaction (POST /machines and the fleet CSV import). A serial already
// registered in the organisation is a unique violation (23505).
export const registerMachine = async (
  client: PoolClient,
  registrar: Registrar,
  machine: NewMachine,
): Promise<string> => {
  const groupId = resolveNewMachineGroup({
    ...registrar,
    groupId: machine.groupId,
  });
  if (
    groupId &&
    !(await findLiveGroups(client, registrar.tenantId, [groupId])).length
  ) {
    throw new BadRequestException(GROUP_NOT_FOUND_MESSAGE);
  }
  const manufacturerId = await catalogRepository.findModelManufacturerId(
    client,
    { modelId: machine.modelId, tenantId: registrar.tenantId },
  );
  if (!manufacturerId) throw new BadRequestException(UNKNOWN_MODEL_MESSAGE);
  return catalogRepository.insertMachine(client, {
    ...machine,
    tenantId: registrar.tenantId,
    createdBy: registrar.userId,
    manufacturerId,
    groupId,
  });
};
