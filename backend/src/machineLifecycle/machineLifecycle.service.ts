import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { findUserPermissionCodes } from '../auth/userAccess.repository';
import { recordBillingAudit } from '../billing/billingAudit/billingAudit';
import { toBillingDay } from '../billing/billingCalendar/billingDay';
import { DatabaseService } from '../database/database.service';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import { toPersonName } from '../machineHistory/machineHistoryMapper';
import { EnterpriseThresholdService } from './enterpriseThreshold.service';
import { OrganisationBillingAccountService } from './organisationBillingAccount.service';
import {
  canRequestTransfer,
  LifecycleAction,
  listAvailableActions,
  MACHINE_LIFECYCLE_PERMISSION,
  planTransition,
  toLifecycleState,
} from './lifecycleTransitions';
import { applyMachineTransition } from './machineActivations.repository';
import * as lifecycleRepository from './machineLifecycle.repository';
import {
  BulkLifecycleResult,
  LifecycleChangeResult,
  MachineLifecycle,
} from './types/machineLifecycleResponse';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const NO_BILLING_ACCOUNT_MESSAGE =
  'Set up billing for this organisation before changing machine lifecycle.';
const SUSPENDED_MESSAGE =
  'This account is suspended: new activations are paused until it is paid.';
const SELL_BY_TRANSFER_MESSAGE =
  'A machine is sold by transferring it to the receiving organisation.';
const STATE_CHANGED_MESSAGE =
  'This machine changed while you were working on it. Refresh and try again.';

const BECOMES_ACTIVE: LifecycleAction[] = ['activate', 'reactivate'];

@Injectable()
export class MachineLifecycleService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly enterpriseThresholdService: EnterpriseThresholdService,
    private readonly organisationBillingAccountService: OrganisationBillingAccountService,
  ) {}

  getLifecycle = (
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<MachineLifecycle> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const machine = await lifecycleRepository.findLifecycleMachine(
        client,
        actor.tenantId,
        machineId,
      );
      if (!machine) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
      const [events, permissions] = await Promise.all([
        lifecycleRepository.listLifecycleEvents(client, machineId),
        findUserPermissionCodes(client, actor.userId),
      ]);
      const state = toLifecycleState(machine.lifecycle_state);
      const canManage = permissions.includes(MACHINE_LIFECYCLE_PERMISSION);
      return {
        machineId,
        lifecycleState: state,
        availableActions: listAvailableActions(state, canManage),
        canRequestTransfer: canRequestTransfer(state, canManage),
        events: events.map((event) => ({
          id: event.id,
          fromState: event.from_state,
          toState: event.to_state,
          reason: event.reason,
          occurredAt: event.occurred_at.toISOString(),
          actorName:
            event.actor_first_name || event.actor_last_name
              ? toPersonName(event.actor_first_name, event.actor_last_name)
              : null,
          transferId: event.transfer_id,
        })),
      };
    });

  // 'sell' is refused here: it only happens through an approved transfer.
  applyAction = async (
    actor: AuthenticatedUser,
    machineId: string,
    action: LifecycleAction,
    reason: string | null,
    now = new Date(),
  ): Promise<LifecycleChangeResult> => {
    if (BECOMES_ACTIVE.includes(action))
      await this.organisationBillingAccountService.ensureForActivation(actor);
    const machine = await this.databaseService.withTenant(
      actor.tenantId,
      (client) =>
        lifecycleRepository.findLifecycleMachine(
          client,
          actor.tenantId,
          machineId,
        ),
    );
    if (!machine) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
    if (!machine.billing_account_id || !machine.timezone)
      throw new ConflictException(NO_BILLING_ACCOUNT_MESSAGE);
    if (machine.suspended_at && BECOMES_ACTIVE.includes(action))
      throw new ForbiddenException(SUSPENDED_MESSAGE);

    if (action === 'sell')
      throw new ConflictException(SELL_BY_TRANSFER_MESSAGE);

    const current = toLifecycleState(machine.lifecycle_state);
    const today = toBillingDay(now, machine.timezone);
    const plan = planTransition(action, current, today);
    if (!plan)
      throw new ConflictException(`A ${current} machine can't be ${action}d.`);
    const billingAccountId = machine.billing_account_id;

    return this.serviceDatabase.transaction(async (client) => {
      const eventId = await applyMachineTransition(client, {
        machineId,
        tenantId: actor.tenantId,
        billingAccountId,
        fromState: plan.from,
        toState: plan.to,
        activatedOn: plan.activatedOn,
        billingEnd: plan.billingEnd,
        actorUserId: actor.userId,
        reason,
        transferId: null,
      });
      if (!eventId) throw new ConflictException(STATE_CHANGED_MESSAGE);
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'machine_lifecycle',
        entityId: machineId,
        billingAccountId,
        from: plan.from,
        to: plan.to,
        reason,
        metadata: {
          lifecycleAction: action,
          countedFrom: plan.activatedOn,
          billedUntilExclusive: plan.billingEnd,
        },
      });
      const enterpriseReviewRaised =
        plan.to === 'active' &&
        (await this.enterpriseThresholdService.raiseTaskIfReached(
          client,
          actor,
          billingAccountId,
          today,
        ));
      return {
        machineId,
        action,
        fromState: plan.from,
        lifecycleState: plan.to,
        countedFrom: plan.activatedOn,
        billedUntilExclusive: plan.billingEnd,
        enterpriseReviewRaised,
      };
    });
  };

  // Each machine is its own transaction, so one machine in the wrong state
  // doesn't undo the rest; failures come back with their reason.
  applyBulkAction = async (
    actor: AuthenticatedUser,
    machineIds: string[],
    action: LifecycleAction,
    reason: string | null,
  ): Promise<BulkLifecycleResult> => {
    const result: BulkLifecycleResult = { applied: [], failed: [] };
    for (const machineId of machineIds) {
      try {
        result.applied.push(
          await this.applyAction(actor, machineId, action, reason),
        );
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        result.failed.push({ machineId, message: error.message });
      }
    }
    return result;
  };
}
