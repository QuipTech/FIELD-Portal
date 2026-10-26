import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { recordBillingAudit } from '../billingAudit/billingAudit';
import { StripeService } from '../stripe/stripe.service';
import { toStripeGatewayError } from '../stripe/stripeErrors';
import { creditNoteCreateKey } from '../stripe/stripeIdempotencyKeys';
import * as creditNotesRepository from './creditNotes.repository';

const INVOICE_NOT_FOUND_MESSAGE = 'Invoice not found.';
const NOTE_NOT_FOUND_MESSAGE = 'Credit note not found.';
const NOT_ON_STRIPE_MESSAGE =
  'Only an invoice already sent to Stripe can be credited. A draft can simply be corrected.';
const CREDITABLE_STATUSES = ['synced', 'paid', 'payment_failed'];

const toCreditNote = (row: creditNotesRepository.CreditNoteRow) => ({
  id: row.id,
  invoiceId: row.invoice_id,
  amountCents: Number(row.amount_cents),
  reason: row.reason,
  status: row.status,
  stripeCreditNoteId: row.stripe_credit_note_id,
  createdAt: row.created_at.toISOString(),
});

// A final invoice is never edited (spec section 8): a platform admin fixes
// it with a credit note, pushed to Stripe. The note is saved first, so a
// Stripe failure leaves it pending and "retry" resends it with the same
// idempotency key — never a second credit.
@Injectable()
export class CreditNotesService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly stripe: StripeService,
  ) {}

  list = async (invoiceId: string) =>
    (
      await creditNotesRepository.listCreditNotes(
        this.serviceDatabase,
        invoiceId,
      )
    ).map(toCreditNote);

  create = async (
    actor: AuthenticatedUser,
    invoiceId: string,
    input: { amountCents: number; reason: string },
  ) => {
    const note = await this.serviceDatabase.transaction(async (client) => {
      const invoice = await creditNotesRepository.findCreditable(
        client,
        invoiceId,
      );
      if (!invoice) throw new NotFoundException(INVOICE_NOT_FOUND_MESSAGE);
      if (
        !invoice.stripe_invoice_id ||
        !CREDITABLE_STATUSES.includes(invoice.status)
      )
        throw new ConflictException(NOT_ON_STRIPE_MESSAGE);
      if (input.amountCents > Number(invoice.remaining_cents))
        throw new BadRequestException(
          `At most ${(Number(invoice.remaining_cents) / 100).toFixed(2)} can still be credited on this invoice.`,
        );
      const row = await creditNotesRepository.insertCreditNote(client, {
        invoiceId,
        billingAccountId: invoice.billing_account_id,
        amountCents: input.amountCents,
        reason: input.reason,
        createdBy: actor.userId,
      });
      await recordBillingAudit(client, actor, {
        action: 'create',
        entityType: 'billing_credit_note',
        entityId: row.id,
        billingAccountId: invoice.billing_account_id,
        from: null,
        to: { invoiceId, amountCents: input.amountCents },
        reason: input.reason,
      });
      return { row, stripeInvoiceId: invoice.stripe_invoice_id };
    });
    return this.issue(note.row, note.stripeInvoiceId);
  };

  retry = async (creditNoteId: string) => {
    const row = await creditNotesRepository.findCreditNote(
      this.serviceDatabase,
      creditNoteId,
    );
    if (!row) throw new NotFoundException(NOTE_NOT_FOUND_MESSAGE);
    if (row.status === 'issued') return toCreditNote(row);
    const invoice = await this.serviceDatabase.query<{
      stripe_invoice_id: string;
    }>('SELECT stripe_invoice_id FROM billing.invoices WHERE id = $1', [
      row.invoice_id,
    ]);
    return this.issue(row, invoice.rows[0].stripe_invoice_id);
  };

  private issue = async (
    row: creditNotesRepository.CreditNoteRow,
    stripeInvoiceId: string,
  ) => {
    let stripeId: string;
    try {
      const created = await this.stripe.createCreditNote(
        {
          stripeInvoiceId,
          amountCents: Number(row.amount_cents),
          memo: row.reason,
        },
        creditNoteCreateKey(row.id),
      );
      stripeId = created.id;
    } catch (error) {
      throw toStripeGatewayError(error);
    }
    await this.serviceDatabase.transaction((client) =>
      creditNotesRepository.markCreditNoteIssued(client, row.id, stripeId),
    );
    return toCreditNote({
      ...row,
      status: 'issued',
      stripe_credit_note_id: stripeId,
    });
  };
}
