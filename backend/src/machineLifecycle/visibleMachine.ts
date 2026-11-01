import { PoolClient } from 'pg';
import { getAccessibleMachineScope } from '../machineGroups/access/getAccessibleMachineScope';
import { findFleetMachine } from '../machineFleet/machineFleet.repository';
import { findLifecycleMachine } from './machineLifecycle.repository';

type Actor = { tenantId: string; userId: string };

// The lifecycle and transfer lookups, limited to the caller's machine
// scope (machineGroups/access): a machine in a group they can't see is
// undefined/null, so the services answer 404.

export const findVisibleLifecycleMachine = async (
  client: PoolClient,
  actor: Actor,
  machineId: string,
) =>
  findLifecycleMachine(
    client,
    actor.tenantId,
    machineId,
    await getAccessibleMachineScope(client, actor),
  );

export const findTransferMachine = async (
  client: PoolClient,
  actor: Actor,
  machineId: string,
) => {
  const scope = await getAccessibleMachineScope(client, actor);
  return {
    machine: await findLifecycleMachine(
      client,
      actor.tenantId,
      machineId,
      scope,
    ),
    fleetMachine: await findFleetMachine(
      client,
      actor.tenantId,
      machineId,
      scope,
    ),
  };
};
