import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { recordBillingAudit } from '../../billing/billingAudit/billingAudit';
import { toBillingDay } from '../../billing/billingCalendar/billingDay';
import { BillingConfigService } from '../../billing/billingConfig/billingConfig.service';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { planTransition } from '../lifecycleTransitions';
import * as transfersRepository from './machineTransfers.repository';
import { MachineTransfer } from './machineTransferMapper';
import { MachineTransfersService } from './machineTransfers.service';
import {
  NOT_PENDING_MESSAGE,
  TRANSFER_NOT_FOUND_MESSAGE,
  UNIQUE_VIOLATION_CODE,
} from './transferMessages';

const MACHINE_NOT_ACTIVE_MESSAGE =
  'The machine is no longer active, so this transfer cannot complete. Ask the seller to request it again.';
const SERIAL_ALREADY_REGISTERED_MESSAGE =
  'Your organisation already has a machine with this serial number. Remove or correct it, then approve again.';

// The receiving organisation approves (billing spec section 4): the seller's
// charge stops from the first day of next month and the machine arrives
// registered, so the buyer is billed only once they activate it.
@Injectable()
export class MachineTransferApprovalService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingConfig: BillingConfigService,
    private readonly transfersService: MachineTransfersService,
  ) {}

  approveTransfer = async (
    actor: AuthenticatedUser,
    transferId: string,
    note: string | null,
    now = new Date(),
  ): Promise<MachineTransfer> => {
    const { DEFAULT_BILLING_TIMEZONE } = await this.billingConfig.loadConfig();
    try {
      await this.serviceDatabase.transaction(async (client) => {
        const transfer = await transfersRepository.lockTransfer(
          client,
          transferId,
        );
        if (!transfer || transfer.to_tenant_id !== actor.tenantId)
          throw new NotFoundException(TRANSFER_NOT_FOUND_MESSAGE);
        if (transfer.status !== 'requested')
          throw new ConflictException(NOT_PENDING_MESSAGE);
        const seller = await transfersRepository.findSellerActivation(
          client,
          transfer.machine_id,
        );
        const today = toBillingDay(
          now,
          seller?.timezone ?? DEFAULT_BILLING_TIMEZONE,
        );
        // A sale always starts from active, so the plan always exists.
        const billingEnd = planTransition('sell', 'active', today)
          ?.billingEnd as string;
        const completed = await transfersRepository.completeMachineTransfer(
          client,
          {
            transferId,
            billingEnd,
            actorUserId: actor.userId,
            reason: note,
          },
        );
        if (!completed) throw new ConflictException(MACHINE_NOT_ACTIVE_MESSAGE);
        await transfersRepository.recordTransferDecision(client, {
          transferId,
          status: 'completed',
          decidedBy: actor.userId,
          note,
        });
        await recordBillingAudit(client, actor, {
          action: 'update',
          entityType: 'machine_transfer',
          entityId: transferId,
          billingAccountId: seller?.billing_account_id ?? null,
          from: {
            status: 'requested',
            organisationId: transfer.from_tenant_id,
          },
          to: {
            status: 'completed',
            organisationId: transfer.to_tenant_id,
            sellerBillingEnd: billingEnd,
          },
          reason: note,
          metadata: { machineId: transfer.machine_id },
        });
      });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === UNIQUE_VIOLATION_CODE)
        throw new ConflictException(SERIAL_ALREADY_REGISTERED_MESSAGE);
      throw error;
    }
    const incoming = await this.transfersService.listTransfers(
      actor,
      'incoming',
    );
    const approved = incoming.find((transfer) => transfer.id === transferId);
    if (!approved) throw new NotFoundException(TRANSFER_NOT_FOUND_MESSAGE);
    return approved;
  };
}
