import { PoolClient } from 'pg';
import { ACCESSIBLE_MACHINES } from '../machineSharing/access/machineScope';
import { findFleetMachine } from '../machineFleet/machineFleet.repository';
import { findLifecycleMachine } from './machineLifecycle.repository';

type Actor = { tenantId: string; userId: string };

// The lifecycle and transfer lookups: the caller's own organisation's
// machines in their machine scope (machineSharing/access). A shared machine
// or one they can't see is undefined, so the services answer 404; only the
// owner activates, archives or transfers. Runs under withActor.

export const findVisibleLifecycleMachine = async (
  client: PoolClient,
  actor: Actor,
  machineId: string,
) =>
  findLifecycleMachine(client, actor.tenantId, machineId, ACCESSIBLE_MACHINES);

export const findTransferMachine = async (
  client: PoolClient,
  actor: Actor,
  machineId: string,
) => {
  const machine = await findLifecycleMachine(
    client,
    actor.tenantId,
    machineId,
    ACCESSIBLE_MACHINES,
  );
  return {
    machine,
    fleetMachine: machine
      ? await findFleetMachine(
          client,
          actor.tenantId,
          machineId,
          ACCESSIBLE_MACHINES,
        )
      : null,
  };
};
