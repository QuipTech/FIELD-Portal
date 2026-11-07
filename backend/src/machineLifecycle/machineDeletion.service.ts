import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { toBillingDay } from '../billing/billingCalendar/billingDay';
import { DatabaseService } from '../database/database.service';
import { disconnectMachineApp } from '../machineControl/pairing/machineAppPairing.repository';
import { toLifecycleState } from './lifecycleTransitions';
import * as deletionRepository from './machineDeletion.repository';
import {
  assessMachineDeletion,
  billedMonthRange,
  MachineDeletionCheck,
} from './machineDeletionRules';
import { LifecycleMachineRow } from './machineLifecycle.repository';
import { findVisibleLifecycleMachine } from './visibleMachine';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const STATE_CHANGED_MESSAGE =
  'This machine changed while you were working on it. Refresh and try again.';
const FALLBACK_TIME_ZONE = 'UTC';

// Deleting a machine: only the owning organisation, once it's out of active and
// its billing is settled (machineDeletionRules.ts). A soft delete: the machine
// leaves every read, and its records, activation intervals and invoices stay.
@Injectable()
export class MachineDeletionService {
  constructor(private readonly databaseService: DatabaseService) {}

  checkDeletion = (
    actor: AuthenticatedUser,
    machineId: string,
    now = new Date(),
  ): Promise<MachineDeletionCheck> =>
    this.databaseService.withActor(actor, async (client) =>
      this.assess(
        client,
        actor,
        await this.requireMachine(client, actor, machineId),
        now,
      ),
    );

  // Checked again inside the transaction, whatever the screen showed.
  deleteMachine = (
    actor: AuthenticatedUser,
    machineId: string,
    reason: string,
    now = new Date(),
  ): Promise<void> =>
    this.databaseService.withActor(actor, async (client) => {
      const machine = await this.requireMachine(client, actor, machineId);
      const check = await this.assess(client, actor, machine, now);
      if (!check.canDelete) {
        throw new ConflictException({
          statusCode: 409,
          code: check.blocker,
          message: check.message,
        });
      }
      const appDisconnected = await disconnectMachineApp(client, machineId);
      const deleted = await deletionRepository.softDeleteMachine(client, {
        tenantId: actor.tenantId,
        machineId,
        lifecycleState: machine.lifecycle_state,
      });
      if (!deleted) throw new ConflictException(STATE_CHANGED_MESSAGE);
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'delete',
        entityType: 'machine',
        entityId: machineId,
        metadata: {
          reason,
          lifecycleState: machine.lifecycle_state,
          appDisconnected,
        },
      });
    });

  private requireMachine = async (
    client: PoolClient,
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<LifecycleMachineRow> => {
    const machine = await findVisibleLifecycleMachine(client, actor, machineId);
    if (!machine) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
    return machine;
  };

  private assess = async (
    client: PoolClient,
    actor: AuthenticatedUser,
    machine: LifecycleMachineRow,
    now: Date,
  ): Promise<MachineDeletionCheck> => {
    const intervals = await deletionRepository.listBillingIntervals(
      client,
      machine.id,
    );
    const range = billedMonthRange(intervals);
    return assessMachineDeletion({
      state: toLifecycleState(machine.lifecycle_state),
      today: toBillingDay(now, machine.timezone ?? FALLBACK_TIME_ZONE),
      openCaseCount: await deletionRepository.countOpenCases(
        client,
        actor.tenantId,
        machine.id,
      ),
      hasPendingTransfer: await deletionRepository.hasPendingTransfer(
        client,
        machine.id,
      ),
      intervals,
      invoices: range
        ? await deletionRepository.listMonthlyInvoices(
            client,
            range.firstMonth,
            range.lastMonth,
          )
        : [],
      runPassedFinalMonth: range
        ? await deletionRepository.hasDailySnapshot(client, range.billingEnd)
        : false,
    });
  };
}
