import { Injectable } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { listOverdueInvoices } from './collections.repository';

export interface OverdueInvoice {
  invoiceId: string;
  billingAccountId: string;
  accountName: string;
  paymentType: string;
  invoiceKind: string;
  periodStart: string | null;
  dueOn: string;
  daysOverdue: number;
  outstandingCents: number;
  hostedInvoiceUrl: string | null;
  // The latest reminder sent, as days from the due date.
  lastReminderOffset: number | null;
  suspended: boolean;
  creditLimitCents: number | null;
  accountUnpaidCents: number;
  overCreditLimit: boolean;
}

// The platform administrator's Overdue list: every unpaid organisation
// invoice past its due date, most overdue first.
@Injectable()
export class OverdueListService {
  constructor(private readonly serviceDatabase: ServiceDatabaseService) {}

  list = async (): Promise<OverdueInvoice[]> =>
    (await listOverdueInvoices(this.serviceDatabase)).map((row) => {
      const creditLimitCents =
        row.credit_limit_cents === null ? null : Number(row.credit_limit_cents);
      const accountUnpaidCents = Number(row.account_unpaid_cents);
      return {
        invoiceId: row.invoice_id,
        billingAccountId: row.billing_account_id,
        accountName: row.account_name,
        paymentType: row.payment_type,
        invoiceKind: row.kind,
        periodStart: row.period_start,
        dueOn: row.due_on,
        daysOverdue: Number(row.days_overdue),
        outstandingCents: Number(row.outstanding_cents),
        hostedInvoiceUrl: row.hosted_invoice_url,
        lastReminderOffset: row.last_reminder_offset,
        suspended: row.suspended_at !== null,
        creditLimitCents,
        accountUnpaidCents,
        overCreditLimit:
          creditLimitCents !== null && accountUnpaidCents > creditLimitCents,
      };
    });
}
