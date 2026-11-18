import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { findAccountTerms } from '../accountTerms/accountTerms.repository';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { BillingNotifier } from '../billingNotices/billingNotifier.service';
import { recordBillingAudit } from '../billingAudit/billingAudit';
import { InvoicesService } from '../invoices/invoices.service';
import { InvoiceDetail } from '../invoices/types/invoiceResponse';
import * as runInvoicesRepository from './runInvoices.repository';

const NOT_IN_REVIEW_MESSAGE =
  'Only a monthly invoice still in its review window can be held.';
const NOT_HELD_MESSAGE = 'This invoice is not on hold.';

// Monthly run, step 3 (billing spec section 9): a drafted invoice waits
// INVOICE_REVIEW_HOURS, then finalises and goes to Stripe unless a billing
// administrator has held it. A held invoice waits until it is released.
@Injectable()
export class InvoiceReviewService {
  private readonly logger = new Logger(InvoiceReviewService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingAccounts: BillingAccountsService,
    private readonly invoices: InvoicesService,
    private readonly notifier: BillingNotifier,
  ) {}

  finaliseDueInvoices = async (now: Date): Promise<string[]> => {
    const due = await runInvoicesRepository.listInvoicesDueForFinalisation(
      this.serviceDatabase,
      now,
    );
    const finalised: string[] = [];
    for (const { id } of due) {
      try {
        const invoice = await this.invoices.getInvoice(id);
        const account = await this.billingAccounts.requireAccount(
          invoice.billingAccountId,
        );
        await this.invoices.finaliseInvoice(id, account.billing_email);
        finalised.push(id);
        await this.warnIfPoMissing(invoice.billingAccountId, invoice.poNumber);
      } catch (error) {
        // Left as it is; the next run retries without duplicating anything.
        this.logger.error(`Finalising invoice ${id} failed: ${String(error)}`);
      }
    }
    return finalised;
  };

  // A PO number is required but none was given: the invoice still went out
  // (with "PO: Not provided") and QuipTech is told, so it can follow up.
  private warnIfPoMissing = async (
    billingAccountId: string,
    invoicePoNumber: string | null,
  ): Promise<void> => {
    try {
      const terms = await findAccountTerms(
        this.serviceDatabase,
        billingAccountId,
      );
      if (!terms?.po_required || invoicePoNumber || terms.default_po_number)
        return;
      await this.notifier.notifyPlatformAdmins({
        title: 'Invoice sent without a PO number',
        body: `${terms.name} requires a PO number, but none was entered before its invoice was finalised. It was sent marked "PO number: Not provided".`,
        link: '/admin/billing-accounts',
      });
    } catch (error) {
      this.logger.warn(
        `PO check for account ${billingAccountId} failed: ${String(error)}`,
      );
    }
  };

  holdInvoice = async (
    actor: AuthenticatedUser,
    invoiceId: string,
    reason: string,
  ): Promise<InvoiceDetail> => {
    await this.serviceDatabase.transaction(async (client) => {
      const held = await runInvoicesRepository.holdRunInvoice(client, {
        invoiceId,
        heldBy: actor.userId,
        reason,
      });
      if (!held) throw new ConflictException(NOT_IN_REVIEW_MESSAGE);
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_invoice',
        entityId: invoiceId,
        billingAccountId: held.billing_account_id,
        from: { held: false },
        to: { held: true },
        reason,
      });
    });
    return this.invoices.getInvoice(invoiceId);
  };

  releaseInvoice = async (
    actor: AuthenticatedUser,
    invoiceId: string,
    reason: string | null,
  ): Promise<InvoiceDetail> => {
    await this.serviceDatabase.transaction(async (client) => {
      const released = await runInvoicesRepository.releaseRunInvoice(
        client,
        invoiceId,
      );
      if (!released) throw new ConflictException(NOT_HELD_MESSAGE);
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_invoice',
        entityId: invoiceId,
        billingAccountId: released.billing_account_id,
        from: { held: true, holdReason: released.hold_reason },
        to: { held: false },
        reason,
      });
    });
    return this.invoices.getInvoice(invoiceId);
  };
}
