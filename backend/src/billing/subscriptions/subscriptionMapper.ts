import { toIsoDay } from '../../common/utils/toIsoDay';
import { Subscription, SubscriptionRow } from './subscriptionTypes';

const toOptionalDay = (value: Date | null): string | null =>
  value ? toIsoDay(value) : null;

export const toSubscription = (row: SubscriptionRow): Subscription => ({
  id: row.id,
  billingAccountId: row.billing_account_id,
  planCode: row.plan_code,
  priceBookId: row.price_book_id,
  term: row.term,
  committedQty: row.committed_qty,
  annualMonthsCharged: row.annual_months_charged,
  contractAnnualCents:
    row.contract_annual_cents === null
      ? null
      : Number(row.contract_annual_cents),
  status: row.status,
  startedAt: row.started_at.toISOString(),
  currentPeriodStart: toIsoDay(row.current_period_start),
  currentPeriodEnd: toIsoDay(row.current_period_end),
  cancelAt: toOptionalDay(row.cancel_at),
  exportUntil: toOptionalDay(row.export_until),
  deleteAfter: toOptionalDay(row.delete_after),
  nextTerm: row.next_term ?? null,
  nextCommittedQty: row.next_committed_qty ?? null,
});
