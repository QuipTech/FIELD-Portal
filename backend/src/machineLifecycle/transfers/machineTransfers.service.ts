import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { recordBillingAudit } from '../../billing/billingAudit/billingAudit';
import { DatabaseService } from '../../database/database.service';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { findFleetMachine } from '../../machineFleet/machineFleet.repository';
import { toLifecycleState } from '../lifecycleTransitions';
import { findLifecycleMachine } from '../machineLifecycle.repository';
import * as transfersRepository from './machineTransfers.repository';
import { MachineTransfer, toMachineTransfer } from './machineTransferMapper';
import {
  NOT_PENDING_MESSAGE,
  TRANSFER_NOT_FOUND_MESSAGE,
  UNIQUE_VIOLATION_CODE,
} from './transferMessages';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const NOT_ACTIVE_MESSAGE = 'Only an active machine can be transferred.';
const ORGANISATION_NOT_FOUND_MESSAGE =
  'No organisation has that ID. Ask the receiving organisation for theirs.';
const SAME_ORGANISATION_MESSAGE =
  "A machine can't be transferred to its own organisation.";
const ALREADY_PENDING_MESSAGE =
  'This machine already has a transfer waiting for approval.';

// Sale or transfer between organisations (spec section 4): the owning
// organisation requests, the receiving one approves or rejects, and the
// requester can cancel while it waits.
@Injectable()
export class MachineTransfersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly serviceDatabase: ServiceDatabaseService,
  ) {}

  requestTransfer = async (
    actor: AuthenticatedUser,
    machineId: string,
    params: { receivingOrganisationSlug: string; reason: string },
  ): Promise<MachineTransfer> => {
    const { machine, fleetMachine } = await this.databaseService.withTenant(
      actor.tenantId,
      async (client) => ({
        machine: await findLifecycleMachine(client, actor.tenantId, machineId),
        fleetMachine: await findFleetMachine(client, actor.tenantId, machineId),
      }),
    );
    if (!machine || !fleetMachine)
      throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
    if (toLifecycleState(machine.lifecycle_state) !== 'active')
      throw new ConflictException(NOT_ACTIVE_MESSAGE);
    const receiving = await transfersRepository.findOrganisationBySlug(
      this.serviceDatabase,
      params.receivingOrganisationSlug,
    );
    if (!receiving)
      throw new BadRequestException(ORGANISATION_NOT_FOUND_MESSAGE);
    if (receiving.id === actor.tenantId)
      throw new BadRequestException(SAME_ORGANISATION_MESSAGE);

    try {
      const transferId = await this.serviceDatabase.transaction(
        async (client) => {
          const id = await transfersRepository.insertTransfer(client, {
            machineId,
            fromTenantId: actor.tenantId,
            toTenantId: receiving.id,
            reason: params.reason,
            machineSummary: {
              label: fleetMachine.label,
              serialNumber: fleetMachine.serial_number,
              manufacturer: fleetMachine.manufacturer_name,
              model: fleetMachine.model_name,
            },
            requestedBy: actor.userId,
          });
          await recordBillingAudit(client, actor, {
            action: 'create',
            entityType: 'machine_transfer',
            entityId: id,
            billingAccountId: machine.billing_account_id,
            from: { organisationId: actor.tenantId },
            to: { organisationId: receiving.id, status: 'requested' },
            reason: params.reason,
            metadata: { machineId },
          });
          return id;
        },
      );
      return this.requireTransfer(actor.tenantId, 'outgoing', transferId);
    } catch (error) {
      if ((error as { code?: string } | null)?.code === UNIQUE_VIOLATION_CODE)
        throw new ConflictException(ALREADY_PENDING_MESSAGE);
      throw error;
    }
  };

  listTransfers = async (
    actor: AuthenticatedUser,
    direction: transfersRepository.TransferDirection,
  ): Promise<MachineTransfer[]> =>
    (
      await transfersRepository.listTransfers(
        this.serviceDatabase,
        actor.tenantId,
        direction,
      )
    ).map(toMachineTransfer);

  // Previous owners in order. Only for a machine the caller can see.
  listChainOfCustody = async (
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<MachineTransfer[]> => {
    const machine = await this.databaseService.withTenant(
      actor.tenantId,
      (client) => findLifecycleMachine(client, actor.tenantId, machineId),
    );
    if (!machine) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
    return (
      await transfersRepository.listCompletedTransfers(
        this.serviceDatabase,
        machineId,
      )
    ).map(toMachineTransfer);
  };

  rejectTransfer = (
    actor: AuthenticatedUser,
    transferId: string,
    note: string | null,
  ) => this.closeTransfer(actor, transferId, 'rejected', note);

  cancelTransfer = (
    actor: AuthenticatedUser,
    transferId: string,
    note: string | null,
  ) => this.closeTransfer(actor, transferId, 'cancelled', note);

  // The receiving organisation rejects; the requesting one cancels.
  private closeTransfer = async (
    actor: AuthenticatedUser,
    transferId: string,
    status: 'rejected' | 'cancelled',
    note: string | null,
  ): Promise<MachineTransfer> => {
    const partyColumn =
      status === 'rejected' ? 'to_tenant_id' : 'from_tenant_id';
    await this.serviceDatabase.transaction(async (client) => {
      const transfer = await transfersRepository.lockTransfer(
        client,
        transferId,
      );
      if (!transfer || transfer[partyColumn] !== actor.tenantId)
        throw new NotFoundException(TRANSFER_NOT_FOUND_MESSAGE);
      if (transfer.status !== 'requested')
        throw new ConflictException(NOT_PENDING_MESSAGE);
      await transfersRepository.recordTransferDecision(client, {
        transferId,
        status,
        decidedBy: actor.userId,
        note,
      });
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'machine_transfer',
        entityId: transferId,
        billingAccountId: null,
        from: 'requested',
        to: status,
        reason: note,
      });
    });
    return this.requireTransfer(
      actor.tenantId,
      status === 'rejected' ? 'incoming' : 'outgoing',
      transferId,
    );
  };

  private requireTransfer = async (
    tenantId: string,
    direction: transfersRepository.TransferDirection,
    transferId: string,
  ): Promise<MachineTransfer> => {
    const rows = await transfersRepository.listTransfers(
      this.serviceDatabase,
      tenantId,
      direction,
    );
    const row = rows.find((candidate) => candidate.id === transferId);
    if (!row) throw new NotFoundException(TRANSFER_NOT_FOUND_MESSAGE);
    return toMachineTransfer(row);
  };
}
