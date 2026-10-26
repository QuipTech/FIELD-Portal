import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { recordBillingAudit } from '../billingAudit/billingAudit';
import { toBillingDay } from '../billingCalendar/billingDay';
import { UpFrontInvoiceService } from '../invoices/upFrontInvoice.service';
import { calculateOnboardingLine } from '../invoices/upFrontLines';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { PLAN_CODES } from '../subscriptions/planCodes';
import * as onboardingRepository from './onboarding.repository';

const JOB_NOT_SCHEDULED_MESSAGE =
  'This onboarding job is not scheduled (it may already be completed or waived).';

const toJob = (row: onboardingRepository.OnboardingJobRow) => ({
  id: row.id,
  billingAccountId: row.billing_account_id,
  accountName: row.account_name,
  siteName: row.site_name,
  status: row.status,
  invoiceId: row.invoice_id,
  waivedReason: row.waived_reason,
  completedAt: row.completed_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
});

// Assisted onboarding (spec section 7): A$2,500 per site from the price
// book, one invoice line when the job is marked complete, never
// recurring. A waiver needs a reason and is audit-logged. Fleet
// self-import is free and never goes through here.
@Injectable()
export class OnboardingService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingAccounts: BillingAccountsService,
    private readonly priceBooks: PriceBooksService,
    private readonly upFrontInvoices: UpFrontInvoiceService,
  ) {}

  list = async (billingAccountId: string | null) =>
    (
      await onboardingRepository.listOnboardingJobs(
        this.serviceDatabase,
        billingAccountId,
      )
    ).map(toJob);

  schedule = async (
    actor: AuthenticatedUser,
    billingAccountId: string,
    siteName: string,
  ) => {
    await this.billingAccounts.requireAccount(billingAccountId);
    const jobId = await this.serviceDatabase.transaction(async (client) => {
      const id = await onboardingRepository.insertOnboardingJob(client, {
        billingAccountId,
        siteName,
        createdBy: actor.userId,
      });
      await recordBillingAudit(client, actor, {
        action: 'create',
        entityType: 'billing_onboarding_job',
        entityId: id,
        billingAccountId,
        from: null,
        to: { siteName, status: 'scheduled' },
        reason: 'assisted onboarding scheduled',
      });
      return id;
    });
    return { id: jobId };
  };

  // Invoices the site's onboarding at the price in effect today.
  complete = async (
    actor: AuthenticatedUser,
    jobId: string,
    now = new Date(),
  ) => {
    const { invoiceId, billingAccountId } =
      await this.serviceDatabase.transaction(async (client) => {
        const job = await onboardingRepository.lockScheduledJob(client, jobId);
        if (!job) throw new NotFoundException(JOB_NOT_SCHEDULED_MESSAGE);
        const account = await this.billingAccounts.requireAccount(
          job.billing_account_id,
        );
        const today = toBillingDay(now, account.timezone);
        const book = await this.priceBooks.getPriceBookInEffect(
          PLAN_CODES.onboardAssisted,
          today,
        );
        const line = calculateOnboardingLine(job.site_name, today, book);
        const id = await this.upFrontInvoices.draft(client, actor, {
          billingAccountId: job.billing_account_id,
          kind: 'onboarding',
          periodStart: null,
          periodEnd: null,
          lines: [line],
          reason: `assisted onboarding completed: ${job.site_name}`,
        });
        await onboardingRepository.closeOnboardingJob(client, {
          jobId,
          status: 'completed',
          invoiceId: id,
          waivedReason: null,
          closedBy: actor.userId,
        });
        return { invoiceId: id, billingAccountId: job.billing_account_id };
      });
    await this.upFrontInvoices.finalise(invoiceId, billingAccountId);
    return { id: jobId, invoiceId };
  };

  waive = async (actor: AuthenticatedUser, jobId: string, reason: string) => {
    await this.serviceDatabase.transaction(async (client) => {
      const job = await onboardingRepository.lockScheduledJob(client, jobId);
      if (!job) throw new NotFoundException(JOB_NOT_SCHEDULED_MESSAGE);
      await onboardingRepository.closeOnboardingJob(client, {
        jobId,
        status: 'waived',
        invoiceId: null,
        waivedReason: reason,
        closedBy: actor.userId,
      });
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_onboarding_job',
        entityId: jobId,
        billingAccountId: job.billing_account_id,
        from: { status: 'scheduled' },
        to: { status: 'waived' },
        reason,
      });
    });
    return { id: jobId, status: 'waived' as const };
  };
}
