import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { runAuditedChange } from '../../common/audit/runAuditedChange';
import { toLimitOffset } from '../../common/dto/paginationQueryDto';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import * as invoicesRepository from './invoices.repository';
import { InvoiceStripeSyncService } from './invoiceStripeSync.service';
import { InvoiceEmailNotifier } from './invoiceEmailNotifier.service';
import { calculateLineAmountCents, sumAmountCents } from './invoiceAmounts';
import { CreateTestInvoiceDto } from './dto/createTestInvoiceDto';
import { ListInvoicesQueryDto } from './dto/listInvoicesQueryDto';
import {
  InvoiceDetail,
  InvoiceList,
  toInvoiceDetail,
  toInvoiceSummary,
} from './types/invoiceResponse';

const TEST_LINE_TYPE = 'test';
const INVOICE_NOT_FOUND_MESSAGE = 'Invoice not found.';
const ACCOUNT_NOT_FOUND_MESSAGE = 'Billing account not found.';
// The draft insert has no unique key a caller can collide on.
const UNEXPECTED_CONFLICT_MESSAGE =
  'The invoice could not be saved. Try again.';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingAccountsService: BillingAccountsService,
    private readonly invoiceStripeSync: InvoiceStripeSyncService,
    private readonly invoiceEmailNotifier: InvoiceEmailNotifier,
  ) {}

  // Saves the draft (audited), pushes it to Stripe, then emails the hosted
  // link. If Stripe fails the invoice stays saved (status final) and the
  // error is returned as a 502.
  createTestInvoice = async (
    actor: AuthenticatedUser,
    dto: CreateTestInvoiceDto,
  ): Promise<InvoiceDetail> => {
    const account = await this.billingAccountsService.requireAccount(
      dto.billingAccountId,
    );
    const lines = dto.lines.map((line) => ({
      lineType: TEST_LINE_TYPE,
      description: line.description,
      quantity: line.quantity,
      unitCents: line.unitCents,
      amountCents: calculateLineAmountCents(line.quantity, line.unitCents),
    }));
    const invoiceId = await runAuditedChange(
      this.databaseService,
      actor,
      UNEXPECTED_CONFLICT_MESSAGE,
      async (client) => {
        const id = await invoicesRepository.createDraftInvoice(
          client,
          dto.billingAccountId,
          lines,
        );
        if (!id) throw new NotFoundException(ACCOUNT_NOT_FOUND_MESSAGE);
        const metadata = {
          billingAccountId: dto.billingAccountId,
          lineCount: lines.length,
          totalExGstCents: sumAmountCents(
            lines.map((line) => line.amountCents),
          ),
        };
        return {
          result: id,
          audit: {
            action: 'create',
            entityType: 'billing_invoice',
            entityId: id,
            metadata,
          },
        };
      },
    );
    return this.finaliseInvoice(invoiceId, account.billing_email);
  };

  // Pushes a saved invoice to Stripe (final → synced) and emails the hosted
  // link. If Stripe fails the invoice stays saved and the error is a 502.
  finaliseInvoice = async (
    invoiceId: string,
    billingEmail: string,
  ): Promise<InvoiceDetail> => {
    await this.invoiceStripeSync.pushInvoice(
      await this.requireInvoice(invoiceId),
    );
    const invoice = await this.getInvoice(invoiceId);
    await this.invoiceEmailNotifier.sendInvoiceReady(invoice, billingEmail);
    return invoice;
  };

  listInvoices = async (query: ListInvoicesQueryDto): Promise<InvoiceList> => {
    const { rows, total } = await invoicesRepository.listInvoicesPage(
      this.serviceDatabase,
      {
        billingAccountId: query.billingAccountId,
        status: query.status,
        ...toLimitOffset(query),
      },
    );
    return {
      items: rows.map(toInvoiceSummary),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  };

  getInvoice = async (invoiceId: string): Promise<InvoiceDetail> => {
    const invoice = await this.requireInvoice(invoiceId);
    const lines = await invoicesRepository.listInvoiceLines(
      this.serviceDatabase,
      invoiceId,
    );
    return toInvoiceDetail(invoice, lines);
  };

  private requireInvoice = async (invoiceId: string) => {
    const invoice = await invoicesRepository.findInvoice(
      this.serviceDatabase,
      invoiceId,
    );
    if (!invoice) throw new NotFoundException(INVOICE_NOT_FOUND_MESSAGE);
    return invoice;
  };
}
