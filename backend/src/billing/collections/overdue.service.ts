import { Injectable, Logger } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { toBillingDay } from '../billingCalendar/billingDay';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import {
  BillingNotice,
  BillingNotifier,
} from '../billingNotices/billingNotifier.service';
import { formatCents } from '../invoices/formatCents';
import * as collectionsRepository from './collections.repository';
import {
  daysBetween,
  findCreditLimitAction,
  findReminderDue,
  reminderLeadDays,
} from './overdueRules';

const BILLING_LINK = '/settings/billing';
const ADMIN_BILLING_LINK = '/admin/billing-accounts';

// Payment reminders and the credit limit warning, from the hourly billing
// job. Reminders go out on INVOICE_REMINDER_OFFSET_DAYS around the due date
// to the billing contact, the accounts email and the organisation's billing
// admins. Nothing here suspends or blocks anyone: suspension is a platform
// admin's decision (accountSuspension.service.ts).
@Injectable()
export class OverdueService {
  private readonly logger = new Logger(OverdueService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingConfig: BillingConfigService,
    private readonly notifier: BillingNotifier,
  ) {}

  // The reminders sent this run.
  sendDueNotices = async (now: Date): Promise<number> => {
    const config = await this.billingConfig.loadConfig();
    const offsets = config.INVOICE_REMINDER_OFFSET_DAYS;
    if (!offsets.length) return 0;
    const invoices = await collectionsRepository.listInvoicesForReminders(
      this.serviceDatabase,
      reminderLeadDays(offsets),
    );
    let sent = 0;
    for (const invoice of invoices) {
      const today = toBillingDay(now, invoice.timezone);
      const offsetDays = findReminderDue({
        dueOn: invoice.due_on,
        today,
        offsets,
        sentOffsets: invoice.sent_offsets.map(Number),
        collectionMethod: invoice.collection_method,
      });
      if (offsetDays === null) continue;
      try {
        if (
          !(await collectionsRepository.recordReminderSent(
            this.serviceDatabase,
            {
              invoiceId: invoice.id,
              billingAccountId: invoice.billing_account_id,
              offsetDays,
            },
          ))
        )
          continue;
        const message = describeReminder(
          invoice,
          daysBetween(invoice.due_on, today),
        );
        await this.notifier.emailBillingContact(invoice.billing_email, message);
        if (
          invoice.accounts_email &&
          invoice.accounts_email.toLowerCase() !==
            invoice.billing_email.toLowerCase()
        )
          await this.notifier.emailBillingContact(
            invoice.accounts_email,
            message,
          );
        await this.notifier.notifyAccountAdmins(
          invoice.billing_account_id,
          message,
        );
        sent++;
      } catch (error) {
        this.logger.error(
          `Reminder for invoice ${invoice.id} failed: ${String(error)}`,
        );
      }
    }
    return sent;
  };

  // Warns platform administrators once when an account's unpaid balance
  // goes over its credit limit. Never blocks the account. The warnings sent.
  checkCreditLimits = async (): Promise<number> => {
    const accounts = await collectionsRepository.listCreditLimitAccounts(
      this.serviceDatabase,
    );
    let warned = 0;
    for (const account of accounts) {
      const unpaidCents = Number(account.unpaid_cents);
      const creditLimitCents =
        account.credit_limit_cents === null
          ? null
          : Number(account.credit_limit_cents);
      const action = findCreditLimitAction({
        unpaidCents,
        creditLimitCents,
        warned: account.credit_limit_warned_at !== null,
      });
      if (!action) continue;
      try {
        const changed = await collectionsRepository.setCreditLimitWarned(
          this.serviceDatabase,
          account.id,
          action === 'warn',
        );
        if (!changed || action === 'clear') continue;
        await this.notifier.notifyPlatformAdmins({
          title: 'Credit limit exceeded',
          body: `${account.name} owes ${formatCents(unpaidCents, 'AUD')} on unpaid invoices, over its credit limit of ${formatCents(creditLimitCents ?? 0, 'AUD')}. Nothing has been blocked; review the account.`,
          link: ADMIN_BILLING_LINK,
        });
        warned++;
      } catch (error) {
        this.logger.error(
          `Credit limit check for account ${account.id} failed: ${String(error)}`,
        );
      }
    }
    return warned;
  };
}

const describeReminder = (
  invoice: collectionsRepository.ReminderInvoiceRow,
  daysFromDue: number,
): BillingNotice => {
  const amount = formatCents(Number(invoice.outstanding_cents), 'AUD');
  const pay = invoice.hosted_invoice_url
    ? ` View and pay it here: ${invoice.hosted_invoice_url}`
    : '';
  const plural = (days: number) => `${days} day${days === 1 ? '' : 's'}`;
  if (daysFromDue < 0)
    return {
      title: 'Invoice due soon',
      body: `Your FIELD invoice for ${amount} is due on ${invoice.due_on}, in ${plural(-daysFromDue)}.${pay}`,
      link: BILLING_LINK,
    };
  if (daysFromDue === 0)
    return {
      title: 'Invoice due today',
      body: `Your FIELD invoice for ${amount} is due today (${invoice.due_on}).${pay}`,
      link: BILLING_LINK,
    };
  return {
    title: `Invoice ${plural(daysFromDue)} overdue`,
    body: `Your FIELD invoice for ${amount} was due on ${invoice.due_on} and is now ${plural(daysFromDue)} overdue. Please pay it as soon as you can. Work already under way is never stopped.${pay}`,
    link: BILLING_LINK,
  };
};
