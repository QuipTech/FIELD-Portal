import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { recordBillingAudit } from '../billingAudit/billingAudit';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { BillingNotifier } from '../billingNotices/billingNotifier.service';
import * as collectionsRepository from './collections.repository';
import { firstSuspensionDay } from './overdueRules';

const ACCOUNT_NOT_FOUND_MESSAGE = 'Billing account not found.';
const NOTHING_OVERDUE_MESSAGE =
  'This account has no overdue invoice that has had its first notice, so it cannot be suspended.';

// Suspension for non-payment (spec section 9): a platform admin's
// decision, allowed SUSPENSION_NOTICE_DAYS after the first overdue
// notice. It blocks new AI sessions and new activations only; nothing in
// progress is stopped, and reading and export stay available.
@Injectable()
export class AccountSuspensionService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingConfig: BillingConfigService,
    private readonly notifier: BillingNotifier,
  ) {}

  suspend = async (
    actor: AuthenticatedUser,
    billingAccountId: string,
    reason: string,
    now = new Date(),
  ) => {
    const [firstNotice, config] = await Promise.all([
      collectionsRepository.findFirstUnpaidNotice(
        this.serviceDatabase,
        billingAccountId,
      ),
      this.billingConfig.loadConfig(),
    ]);
    const allowedFrom = firstSuspensionDay(
      firstNotice,
      config.SUSPENSION_NOTICE_DAYS,
    );
    if (!allowedFrom) throw new ConflictException(NOTHING_OVERDUE_MESSAGE);
    if (allowedFrom > now)
      throw new ConflictException(
        `The notice period runs until ${allowedFrom.toISOString().slice(0, 10)}; the account can be suspended after that.`,
      );
    const suspendedAt = await this.change(actor, billingAccountId, reason);
    await this.notifier.notifyAccountAdmins(billingAccountId, {
      title: 'Account paused for non-payment',
      body: 'New machine activations and new AI sessions are paused until your overdue invoices are paid. Work already under way continues, and all your records stay available.',
      link: '/settings/billing',
    });
    return { billingAccountId, suspendedAt };
  };

  unsuspend = async (
    actor: AuthenticatedUser,
    billingAccountId: string,
    reason: string,
  ) => {
    await this.change(actor, billingAccountId, null, reason);
    await this.notifier.notifyAccountAdmins(billingAccountId, {
      title: 'Account active again',
      body: 'Machine activations and new AI sessions are available again.',
      link: '/settings/billing',
    });
    return { billingAccountId, suspendedAt: null };
  };

  private change = (
    actor: AuthenticatedUser,
    billingAccountId: string,
    suspensionReason: string | null,
    auditReason = suspensionReason ?? '',
  ) =>
    this.serviceDatabase.transaction(async (client) => {
      const saved = await collectionsRepository.setSuspension(
        client,
        billingAccountId,
        suspensionReason,
      );
      if (!saved) throw new NotFoundException(ACCOUNT_NOT_FOUND_MESSAGE);
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_account',
        entityId: billingAccountId,
        billingAccountId,
        from: { suspended: suspensionReason === null },
        to: { suspended: suspensionReason !== null },
        reason: auditReason,
      });
      return saved.suspended_at?.toISOString() ?? null;
    });
}
