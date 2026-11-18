import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { recordBillingAudit } from '../billingAudit/billingAudit';
import { toBillingDay } from '../billingCalendar/billingDay';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { BillingNotifier } from '../billingNotices/billingNotifier.service';
import * as termsRepository from './accountTerms.repository';
import {
  AccountStatus,
  AccountTermsChange,
  AccountTermsRow,
  PaymentType,
} from './accountTerms.repository';
import {
  AccountApplication,
  AccountTerms,
  toAccountApplication,
  toAccountTerms,
} from './accountTermsTypes';

const NO_ACCOUNT_MESSAGE =
  'Your organisation has no billing account yet. It is set up when your organisation signs up.';
const ACCOUNT_NOT_FOUND_MESSAGE = 'Billing account not found.';
const ALREADY_APPROVED_MESSAGE =
  'Your organisation already has a 30-day account.';
const ALREADY_APPLIED_MESSAGE =
  'Your application is already with QuipTech for review.';
const NOT_AWAITING_DECISION_MESSAGE =
  'Only a pending or on-hold application can be decided.';
const NOT_PENDING_MESSAGE = 'Only a pending application can be put on hold.';
const DRAFT_NOT_FOUND_MESSAGE =
  'That invoice is no longer a draft, so its PO number can no longer change.';

const ORGANISATION_LINK = '/settings/billing';
const ADMIN_LINK = '/admin/billing-accounts';

export interface AccountApplicationInput {
  legalName: string;
  abn: string;
  accountsEmail: string;
  accountsPhone: string;
  poRequired: boolean;
  notes: string | null;
}

export interface ApprovalInput {
  termsDays: number | null;
  creditLimitCents: number | null;
  notes: string | null;
}

export interface PaymentTermsInput {
  paymentType: PaymentType;
  termsDays: number | null;
  creditLimitCents: number | null;
  poRequired: boolean | null;
  reason: string;
}

// The fields an audit entry shows for a terms change.
const describeTerms = (row: AccountTermsRow) => ({
  paymentType: row.payment_type,
  accountStatus: row.account_status,
  termsDays: row.terms_days,
  creditLimitCents:
    row.credit_limit_cents === null ? null : Number(row.credit_limit_cents),
  poRequired: row.po_required,
});

// How an organisation pays: by card (the default) or on a 30-day account a
// platform administrator approves. Applying never blocks anything: while
// it's pending the organisation keeps working and is invoiced as a card
// customer. Every change is audited in the same transaction.
@Injectable()
export class AccountTermsService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingConfig: BillingConfigService,
    private readonly notifier: BillingNotifier,
  ) {}

  // ── Organisation (billing.manage) ────────────────────────────────────

  getOrganisationTerms = async (
    actor: AuthenticatedUser,
    now = new Date(),
  ): Promise<AccountTerms> => {
    const row = await this.requireOrganisationAccount(actor);
    return toAccountTerms(row, toBillingDay(now, row.timezone));
  };

  apply = async (
    actor: AuthenticatedUser,
    input: AccountApplicationInput,
  ): Promise<AccountTerms> => {
    const account = await this.requireOrganisationAccount(actor);
    const updated = await this.change(
      actor,
      account.id,
      (row) => {
        if (row.account_status === 'approved')
          throw new ConflictException(ALREADY_APPROVED_MESSAGE);
        if (
          row.account_status === 'pending' ||
          row.account_status === 'on_hold'
        )
          throw new ConflictException(ALREADY_APPLIED_MESSAGE);
        return {
          abn: input.abn,
          account_legal_name: input.legalName,
          accounts_email: input.accountsEmail,
          accounts_phone: input.accountsPhone,
          po_required: input.poRequired,
          application_notes: input.notes,
          account_status: 'pending',
          applied_at: 'now',
          applied_by: actor.userId,
          rejected_at: null,
          rejected_by: null,
          rejected_reason: null,
        };
      },
      'applied for a 30-day account',
    );
    await this.notifier.notifyPlatformAdmins({
      title: '30-day account application',
      body: `${input.legalName} (${account.name}, ABN ${input.abn}) has applied for a 30-day account. Review it under Billing → Account applications.`,
      link: ADMIN_LINK,
    });
    return updated;
  };

  // Pay by card. Withdraws an application that hasn't been decided; an
  // approved account keeps its approval so QuipTech can switch it back.
  chooseCard = async (actor: AuthenticatedUser): Promise<AccountTerms> => {
    const account = await this.requireOrganisationAccount(actor);
    return this.change(
      actor,
      account.id,
      (row) => ({
        payment_type: 'card',
        ...(row.account_status === 'pending' || row.account_status === 'on_hold'
          ? { account_status: 'none' as const }
          : {}),
      }),
      'chose to pay by card',
    );
  };

  // The PO number printed on every invoice that doesn't have its own.
  setDefaultPoNumber = async (
    actor: AuthenticatedUser,
    poNumber: string | null,
  ): Promise<AccountTerms> => {
    const account = await this.requireOrganisationAccount(actor);
    return this.change(
      actor,
      account.id,
      () => ({ default_po_number: poNumber }),
      'updated the standing PO number',
    );
  };

  // A PO number for one invoice, while it's still a draft.
  setInvoicePoNumber = async (
    actor: AuthenticatedUser,
    invoiceId: string,
    poNumber: string | null,
  ): Promise<{ invoiceId: string; poNumber: string | null }> => {
    const account = await this.requireOrganisationAccount(actor);
    await this.serviceDatabase.transaction(async (client) => {
      const saved = await termsRepository.setDraftInvoicePoNumber(client, {
        invoiceId,
        billingAccountId: account.id,
        poNumber,
      });
      if (!saved) throw new ConflictException(DRAFT_NOT_FOUND_MESSAGE);
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_invoice',
        entityId: invoiceId,
        billingAccountId: account.id,
        from: null,
        to: { poNumber },
        reason: 'PO number entered',
      });
    });
    return { invoiceId, poNumber };
  };

  findDraftMonthlyInvoice = (billingAccountId: string) =>
    termsRepository.findDraftMonthlyInvoice(
      this.serviceDatabase,
      billingAccountId,
    );

  // ── Platform administrator ───────────────────────────────────────────

  listApplications = async (
    status: AccountStatus | null,
    now = new Date(),
  ): Promise<AccountApplication[]> => {
    const rows = await termsRepository.listApplications(
      this.serviceDatabase,
      status,
    );
    return rows.map((row) =>
      toAccountApplication(row, toBillingDay(now, row.timezone)),
    );
  };

  approve = async (
    actor: AuthenticatedUser,
    billingAccountId: string,
    input: ApprovalInput,
  ): Promise<AccountTerms> => {
    const config = await this.billingConfig.loadConfig();
    const termsDays = input.termsDays ?? config.ACCOUNT_DEFAULT_TERMS_DAYS;
    const updated = await this.change(
      actor,
      billingAccountId,
      (row) => {
        if (
          row.account_status !== 'pending' &&
          row.account_status !== 'on_hold'
        )
          throw new ConflictException(NOT_AWAITING_DECISION_MESSAGE);
        return {
          payment_type: 'account',
          account_status: 'approved',
          terms_days: termsDays,
          credit_limit_cents: input.creditLimitCents,
          credit_limit_warned_at: null,
          approval_notes: input.notes,
          approved_at: 'now',
          approved_by: actor.userId,
        };
      },
      input.notes ?? 'approved 30-day account',
    );
    await this.notifyOrganisation(updated, {
      title: '30-day account approved',
      body: `Your 30-day account has been approved. From your next invoice, FIELD invoices are emailed with ${termsDays} days to pay by bank transfer; no card is charged.`,
      link: ORGANISATION_LINK,
    });
    return updated;
  };

  reject = async (
    actor: AuthenticatedUser,
    billingAccountId: string,
    reason: string,
  ): Promise<AccountTerms> => {
    const updated = await this.change(
      actor,
      billingAccountId,
      (row) => {
        if (
          row.account_status !== 'pending' &&
          row.account_status !== 'on_hold'
        )
          throw new ConflictException(NOT_AWAITING_DECISION_MESSAGE);
        return {
          payment_type: 'card',
          account_status: 'rejected',
          rejected_at: 'now',
          rejected_by: actor.userId,
          rejected_reason: reason,
        };
      },
      reason,
    );
    await this.notifyOrganisation(updated, {
      title: '30-day account not approved',
      body: `Your application for a 30-day account was not approved: ${reason} Please add a card on the Billing page so your invoices can be paid.`,
      link: ORGANISATION_LINK,
    });
    return updated;
  };

  hold = async (
    actor: AuthenticatedUser,
    billingAccountId: string,
    reason: string,
  ): Promise<AccountTerms> => {
    const updated = await this.change(
      actor,
      billingAccountId,
      (row) => {
        if (row.account_status !== 'pending')
          throw new ConflictException(NOT_PENDING_MESSAGE);
        return { account_status: 'on_hold' };
      },
      reason,
    );
    await this.notifyOrganisation(updated, {
      title: '30-day account application on hold',
      body: `QuipTech needs more information before deciding on your 30-day account: ${reason} Nothing is blocked in the meantime.`,
      link: ORGANISATION_LINK,
    });
    return updated;
  };

  // Switches an organisation between card and account at any time.
  // Switching to account approves it with the given (or current) terms.
  setPaymentTerms = async (
    actor: AuthenticatedUser,
    billingAccountId: string,
    input: PaymentTermsInput,
  ): Promise<AccountTerms> => {
    const updated = await this.change(
      actor,
      billingAccountId,
      (row) => ({
        payment_type: input.paymentType,
        ...(input.paymentType === 'account' && {
          account_status: 'approved' as const,
          ...(row.approved_at === null && {
            approved_at: 'now' as const,
            approved_by: actor.userId,
          }),
          rejected_reason: null,
        }),
        ...(input.termsDays !== null && { terms_days: input.termsDays }),
        ...(input.creditLimitCents !== null && {
          credit_limit_cents: input.creditLimitCents,
          credit_limit_warned_at: null,
        }),
        ...(input.poRequired !== null && { po_required: input.poRequired }),
      }),
      input.reason,
    );
    await this.notifyOrganisation(updated, {
      title:
        input.paymentType === 'account'
          ? 'Your organisation now pays on account'
          : 'Your organisation now pays by card',
      body:
        input.paymentType === 'account'
          ? `FIELD invoices are now emailed with ${updated.termsDays} days to pay by bank transfer; no card is charged.`
          : 'FIELD invoices are now paid by card. Add or check your card on the Billing page.',
      link: ORGANISATION_LINK,
    });
    return updated;
  };

  // A credit limit on its own (null = none).
  setCreditLimit = async (
    actor: AuthenticatedUser,
    billingAccountId: string,
    creditLimitCents: number | null,
    reason: string,
  ): Promise<AccountTerms> =>
    this.change(
      actor,
      billingAccountId,
      () => ({
        credit_limit_cents: creditLimitCents,
        credit_limit_warned_at: null,
      }),
      reason,
    );

  // ── Shared ───────────────────────────────────────────────────────────

  private requireOrganisationAccount = async (actor: AuthenticatedUser) => {
    const row = await termsRepository.findOrganisationAccountTerms(
      this.serviceDatabase,
      actor.tenantId,
    );
    if (!row) throw new NotFoundException(NO_ACCOUNT_MESSAGE);
    return row;
  };

  // Locks the account, works out the change from its current state, saves
  // it and audits from → to, all in one transaction.
  private change = async (
    actor: AuthenticatedUser,
    billingAccountId: string,
    decide: (row: AccountTermsRow) => AccountTermsChange,
    reason: string,
    now = new Date(),
  ): Promise<AccountTerms> => {
    const after = await this.serviceDatabase.transaction(
      async (client: PoolClient) => {
        const before = await termsRepository.lockAccountTerms(
          client,
          billingAccountId,
        );
        if (!before) throw new NotFoundException(ACCOUNT_NOT_FOUND_MESSAGE);
        const change = decide(before);
        await termsRepository.updateAccountTerms(
          client,
          billingAccountId,
          change,
        );
        const saved = (await termsRepository.lockAccountTerms(
          client,
          billingAccountId,
        )) as AccountTermsRow;
        await recordBillingAudit(client, actor, {
          action: 'update',
          entityType: 'billing_account',
          entityId: billingAccountId,
          billingAccountId,
          from: describeTerms(before),
          to: describeTerms(saved),
          reason,
          metadata: { change: Object.keys(change) },
        });
        return saved;
      },
    );
    return toAccountTerms(after, toBillingDay(now, after.timezone));
  };

  // The organisation's billing admins (bell and email), plus the accounts
  // email given on the application.
  private notifyOrganisation = async (
    terms: AccountTerms,
    notice: { title: string; body: string; link: string },
  ) => {
    await this.notifier.notifyAccountAdmins(terms.billingAccountId, notice);
    if (terms.application.accountsEmail)
      await this.notifier.emailBillingContact(
        terms.application.accountsEmail,
        notice,
      );
  };
}
