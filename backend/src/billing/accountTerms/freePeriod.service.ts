import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { recordBillingAudit } from '../billingAudit/billingAudit';
import { toBillingDay } from '../billingCalendar/billingDay';
import { BillingNotifier } from '../billingNotices/billingNotifier.service';
import * as termsRepository from './accountTerms.repository';
import { AccountTerms, toAccountTerms } from './accountTermsTypes';

const ACCOUNT_NOT_FOUND_MESSAGE = 'Billing account not found.';
const PAST_DATE_MESSAGE =
  'The free period must end today or later (in the account’s time zone).';

const describeFree = (row: termsRepository.AccountTermsRow) => ({
  freeUntil: row.free_until,
  freePercent: row.free_until ? row.free_percent : null,
});

// A free period, set by a platform administrator: machines activate and
// usage is tracked as normal, and each month up to and including the one
// containing free_until gets a discount line on its machine charges. A
// month that comes to A$0 is recorded but never sent. Billing resumes the
// month after, with no back billing.
@Injectable()
export class FreePeriodService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly notifier: BillingNotifier,
  ) {}

  set = async (
    actor: AuthenticatedUser,
    billingAccountId: string,
    input: { freeUntil: string; freePercent: number; reason: string },
    now = new Date(),
  ): Promise<AccountTerms> => {
    const terms = await this.change(
      actor,
      billingAccountId,
      input.reason,
      now,
      (row) => {
        if (input.freeUntil < toBillingDay(now, row.timezone))
          throw new BadRequestException(PAST_DATE_MESSAGE);
        return {
          free_until: input.freeUntil,
          free_percent: input.freePercent,
          free_reason: input.reason,
          free_set_by: actor.userId,
          free_set_at: 'now',
        };
      },
    );
    await this.notifier.notifyAccountAdmins(billingAccountId, {
      title: 'Free period added',
      body:
        input.freePercent === 100
          ? `Your FIELD machine charges are free until ${input.freeUntil}. Normal billing starts the month after.`
          : `Your FIELD machine charges are ${input.freePercent}% off until ${input.freeUntil}. Normal billing starts the month after.`,
      link: '/settings/billing',
    });
    return terms;
  };

  clear = async (
    actor: AuthenticatedUser,
    billingAccountId: string,
    reason: string,
    now = new Date(),
  ): Promise<AccountTerms> =>
    this.change(actor, billingAccountId, reason, now, () => ({
      free_until: null,
      free_percent: 100,
      free_reason: null,
      free_set_by: actor.userId,
      free_set_at: 'now',
    }));

  private change = async (
    actor: AuthenticatedUser,
    billingAccountId: string,
    reason: string,
    now: Date,
    decide: (
      row: termsRepository.AccountTermsRow,
    ) => termsRepository.AccountTermsChange,
  ): Promise<AccountTerms> => {
    const after = await this.serviceDatabase.transaction(async (client) => {
      const before = await termsRepository.lockAccountTerms(
        client,
        billingAccountId,
      );
      if (!before) throw new NotFoundException(ACCOUNT_NOT_FOUND_MESSAGE);
      await termsRepository.updateAccountTerms(
        client,
        billingAccountId,
        decide(before),
      );
      const saved = (await termsRepository.lockAccountTerms(
        client,
        billingAccountId,
      )) as termsRepository.AccountTermsRow;
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_account',
        entityId: billingAccountId,
        billingAccountId,
        from: describeFree(before),
        to: describeFree(saved),
        reason,
        metadata: { change: 'free_period' },
      });
      return saved;
    });
    return toAccountTerms(after, toBillingDay(now, after.timezone));
  };
}
