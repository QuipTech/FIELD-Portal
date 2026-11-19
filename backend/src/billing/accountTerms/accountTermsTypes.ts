import { isFreePeriodActiveForMonth } from '../discounts/discountRules';
import { firstDayOfMonth } from '../billingCalendar/billingDay';
import {
  AccountStatus,
  AccountTermsRow,
  ApplicationListRow,
  PaymentType,
} from './accountTerms.repository';

export interface AccountTerms {
  billingAccountId: string;
  // The account's billing days (and so its months) are in this time zone.
  timezone: string;
  paymentType: PaymentType;
  accountStatus: AccountStatus;
  // Invoices are sent with account terms (bank transfer, terms_days) only
  // while this is true; otherwise the card flow applies.
  usesAccountTerms: boolean;
  termsDays: number;
  creditLimitCents: number | null;
  poRequired: boolean;
  defaultPoNumber: string | null;
  application: {
    legalName: string | null;
    abn: string | null;
    accountsEmail: string | null;
    accountsPhone: string | null;
    notes: string | null;
    appliedAt: string | null;
    approvedAt: string | null;
    approvalNotes: string | null;
    rejectedAt: string | null;
    rejectedReason: string | null;
  };
  freePeriod: {
    freeUntil: string;
    freePercent: number;
    reason: string | null;
    setAt: string | null;
    // Still discounting this month or a later one.
    active: boolean;
  } | null;
}

export const usesAccountTerms = (
  row: Pick<AccountTermsRow, 'payment_type' | 'account_status'>,
): boolean =>
  row.payment_type === 'account' && row.account_status === 'approved';

export const toAccountTerms = (
  row: AccountTermsRow,
  today: string,
): AccountTerms => ({
  billingAccountId: row.id,
  timezone: row.timezone,
  paymentType: row.payment_type,
  accountStatus: row.account_status,
  usesAccountTerms: usesAccountTerms(row),
  termsDays: row.terms_days,
  creditLimitCents:
    row.credit_limit_cents === null ? null : Number(row.credit_limit_cents),
  poRequired: row.po_required,
  defaultPoNumber: row.default_po_number,
  application: {
    legalName: row.account_legal_name,
    abn: row.abn,
    accountsEmail: row.accounts_email,
    accountsPhone: row.accounts_phone,
    notes: row.application_notes,
    appliedAt: row.applied_at?.toISOString() ?? null,
    approvedAt: row.approved_at?.toISOString() ?? null,
    approvalNotes: row.approval_notes,
    rejectedAt: row.rejected_at?.toISOString() ?? null,
    rejectedReason: row.rejected_reason,
  },
  freePeriod: row.free_until
    ? {
        freeUntil: row.free_until,
        freePercent: row.free_percent,
        reason: row.free_reason,
        setAt: row.free_set_at?.toISOString() ?? null,
        active: isFreePeriodActiveForMonth(
          row.free_until,
          firstDayOfMonth(today),
        ),
      }
    : null,
});

export interface AccountApplication extends AccountTerms {
  accountName: string;
  billingEmail: string;
  organisationNames: string | null;
}

export const toAccountApplication = (
  row: ApplicationListRow,
  today: string,
): AccountApplication => ({
  ...toAccountTerms(row, today),
  accountName: row.name,
  billingEmail: row.billing_email,
  organisationNames: row.organisation_names,
});
