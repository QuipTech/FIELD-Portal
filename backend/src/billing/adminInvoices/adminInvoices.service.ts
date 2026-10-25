import { Injectable, Logger } from '@nestjs/common';
import { toLimitOffset } from '../../common/dto/paginationQueryDto';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { findInvoice } from '../invoices/invoices.repository';
import { toStripeGatewayError } from '../stripe/stripeErrors';
import { PersonalPaymentCheckService } from '../personalSubscription/personalPaymentCheck.service';
import {
  ADMIN_INVOICE_CATEGORIES,
  AdminInvoiceCategory,
} from './adminInvoiceCategories';
import { AdminInvoicesQueryDto } from './adminInvoicesQueryDto';
import {
  AdminInvoiceRow,
  findInvoicesToReconcile,
  listAdminInvoices,
  summariseAdminInvoices,
} from './adminInvoices.repository';

// One "Refresh from Stripe" asks about at most this many invoices, so the
// request stays well inside Stripe's rate limit and the HTTP timeout.
const RECONCILE_LIMIT = 50;

const toNumber = (value: string | null) =>
  value === null ? null : Number(value);

const toAdminInvoice = (row: AdminInvoiceRow) => ({
  id: row.id,
  category: row.category,
  status: row.status,
  kind: row.kind,
  payerEmail: row.payer_email,
  payerName: row.payer_name,
  organisationName: row.organisation_name ?? row.billing_account_name,
  periodStart: row.period_start,
  totalExGstCents: Number(row.total_ex_gst_cents),
  gstCents: toNumber(row.gst_cents),
  totalCents: toNumber(row.total_cents),
  amountPaidCents: Number(row.amount_paid_cents),
  amountRefundedCents: Number(row.amount_refunded_cents),
  stripeInvoiceId: row.stripe_invoice_id,
  hostedInvoiceUrl: row.hosted_invoice_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Every invoice FIELD has issued — each user's personal subscription and
// each organisation's — for the platform admin's billing page.
@Injectable()
export class AdminInvoicesService {
  private readonly logger = new Logger(AdminInvoicesService.name);

  constructor(
    private readonly database: ServiceDatabaseService,
    private readonly paymentCheck: PersonalPaymentCheckService,
  ) {}

  list = async (query: AdminInvoicesQueryDto) => {
    const [{ rows, total }, summaryRows] = await Promise.all([
      listAdminInvoices(this.database, {
        category: query.category,
        search: query.search?.trim() || undefined,
        ...toLimitOffset(query),
      }),
      summariseAdminInvoices(this.database),
    ]);
    const summary = Object.fromEntries(
      ADMIN_INVOICE_CATEGORIES.map((category) => {
        const row = summaryRows.find((item) => item.category === category);
        return [
          category,
          {
            count: Number(row?.count ?? 0),
            totalCents: Number(row?.total_cents ?? 0),
            paidCents: Number(row?.paid_cents ?? 0),
          },
        ];
      }),
    ) as Record<
      AdminInvoiceCategory,
      { count: number; totalCents: number; paidCents: number }
    >;
    return {
      items: rows.map(toAdminInvoice),
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary,
    };
  };

  // Asks Stripe about every invoice that may have been paid without its
  // webhook reaching us, and records the ones Stripe says are paid.
  refreshFromStripe = async () => {
    const ids = await findInvoicesToReconcile(this.database, RECONCILE_LIMIT);
    let updated = 0;
    let failed = 0;
    for (const id of ids) {
      const invoice = await findInvoice(this.database, id);
      if (!invoice) continue;
      try {
        if (await this.paymentCheck.reconcileInvoice(invoice)) updated++;
      } catch (error) {
        failed++;
        const reason = toStripeGatewayError(error);
        this.logger.warn(
          `Stripe refresh failed for invoice ${id}: ${reason instanceof Error ? reason.message : String(reason)}`,
        );
      }
    }
    return { checked: ids.length, updated, failed };
  };
}
