import { Injectable, Logger } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { toBillingDay } from '../billingCalendar/billingDay';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { BillingNotifier } from '../billingNotices/billingNotifier.service';
import { formatCents } from '../invoices/formatCents';
import * as collectionsRepository from './collections.repository';
import { daysBetween, findNoticeDue } from './overdueRules';

const BILLING_LINK = '/settings/billing';

// Overdue accounts (spec section 9), from the hourly billing job: the
// billing contact and the organisation's billing admins hear on day 1 and
// day 7 overdue. Suspension itself is a platform admin's decision
// (accountSuspension.service.ts), allowed after the notice period.
@Injectable()
export class OverdueService {
  private readonly logger = new Logger(OverdueService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingConfig: BillingConfigService,
    private readonly notifier: BillingNotifier,
  ) {}

  // The notices sent this run.
  sendDueNotices = async (now: Date): Promise<number> => {
    const [invoices, config] = await Promise.all([
      collectionsRepository.listUnpaidPastDue(this.serviceDatabase),
      this.billingConfig.loadConfig(),
    ]);
    let sent = 0;
    for (const invoice of invoices) {
      const today = toBillingDay(now, invoice.timezone);
      const notice = findNoticeDue({
        dueOn: invoice.due_on,
        today,
        notice1SentAt: invoice.overdue_notice_1_at,
        notice7SentAt: invoice.overdue_notice_7_at,
      });
      if (!notice) continue;
      try {
        if (
          !(await collectionsRepository.markNoticeSent(
            this.serviceDatabase,
            invoice.id,
            notice,
          ))
        )
          continue;
        const message = describeNotice(
          invoice,
          daysBetween(invoice.due_on, today),
          notice,
          config.SUSPENSION_NOTICE_DAYS,
        );
        await this.notifier.emailBillingContact(invoice.billing_email, message);
        await this.notifier.notifyAccountAdmins(
          invoice.billing_account_id,
          message,
        );
        sent++;
      } catch (error) {
        this.logger.error(
          `Overdue notice for invoice ${invoice.id} failed: ${String(error)}`,
        );
      }
    }
    return sent;
  };
}

const describeNotice = (
  invoice: collectionsRepository.OverdueInvoiceRow,
  daysOverdue: number,
  notice: 'day1' | 'day7',
  noticeDays: number,
) => {
  const outstanding =
    invoice.total_cents === null
      ? 'Your FIELD invoice'
      : `Your FIELD invoice for ${formatCents(Number(invoice.total_cents) - Number(invoice.amount_paid_cents), 'AUD')}`;
  const pay = invoice.hosted_invoice_url
    ? ` Pay it here: ${invoice.hosted_invoice_url}`
    : '';
  return notice === 'day1'
    ? {
        title: 'Invoice overdue',
        body: `${outstanding} was due on ${invoice.due_on} and is now ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue.${pay}`,
        link: BILLING_LINK,
      }
    : {
        title: 'Invoice 7 days overdue',
        body: `${outstanding} is ${daysOverdue} days overdue. If it stays unpaid, new machine activations and new AI sessions may be paused ${noticeDays} days after the first notice. Work already under way is never stopped.${pay}`,
        link: BILLING_LINK,
      };
};
