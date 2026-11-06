import { BadRequestException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { componentBelongsToMachine } from '../machineConfiguration/machineComponents.repository';

const COMPONENT_NOT_FOUND_MESSAGE =
  "That component isn't installed on this machine.";

// A history entry's component must be installed on its machine (tenantId:
// the machine's owning organisation). No component is fine.
export const assertComponentOnMachine = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; componentId?: string },
): Promise<void> => {
  if (!params.componentId) return;
  const isOnMachine = await componentBelongsToMachine(client, {
    tenantId: params.tenantId,
    machineId: params.machineId,
    componentId: params.componentId,
  });
  if (!isOnMachine) throw new BadRequestException(COMPONENT_NOT_FOUND_MESSAGE);
};
