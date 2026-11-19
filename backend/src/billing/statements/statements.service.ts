import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { findAccountTerms } from '../accountTerms/accountTerms.repository';
import { usesAccountTerms } from '../accountTerms/accountTermsTypes';
import { BillingActor, recordBillingAudit } from '../billingAudit/billingAudit';
import {
  firstDayOfMonth,
  firstDayOfNextMonth,
  toBillingDay,
} from '../billingCalendar/billingDay';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import {
  BillingNotice,
  BillingNotifier,
} from '../billingNotices/billingNotifier.service';
import {
  daysBetween,
  findReminderDue,
  reminderLeadDays,
} from '../collections/overdueRules';
import { formatCents } from '../invoices/formatCents';
import { CalculatedLine } from '../monthlyRun/monthlyRunTypes';
import {
  buildReportTable,
  buildZohoTable,
  ExportFormat,
  toCsv,
  toXlsx,
} from './statementExport';
import {
  calculateDueOn,
  calculateStatementTotals,
  canMarkPaid,
  canSetZohoInvoice,
  canVoid,
  countActiveDays,
  daysOverdue,
  formatStatementReference,
  isOverdue,
  StatementStatus,
  summariseStatementLines,
} from './statementRules';
import {
  MonthEndReport,
  MonthEndReportRow,
  OrganisationStatement,
  StatementMachine,
} from './statementTypes';
import * as repository from './statements.repository';

const NOT_FOUND_MESSAGE = 'Statement not found.';
const MONTH_OPEN_MESSAGE =
  "This month hasn't finished yet. Mark it as ready once it has closed.";
const NOT_READY_MESSAGE =
  'Mark the month as ready before entering the Zoho invoice.';
const NOT_INVOICED_MESSAGE =
  'Enter the Zoho invoice number before marking this statement paid.';
const CANNOT_VOID_MESSAGE = 'A paid statement cannot be voided.';
const NO_ORGANISATION_ACCOUNT_MESSAGE =
  "Your organisation doesn't have a billing account yet.";
// How many months ahead a charge looks for a statement still open.
const MAX_MONTHS_AHEAD = 24;
const ADMIN_LINK = '/admin/billing-accounts';
const ORGANISATION_LINK = '/settings/billing';

export interface ExportFile {
  filename: string;
  contentType: string;
  body: Buffer | string;
}

// "2026-11" or any day in it → "2026-11-01".
const toMonthStart = (month: string) =>
  firstDayOfMonth(/^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month);

const toActor = (user: AuthenticatedUser): BillingActor => ({
  userId: user.userId,
  tenantId: user.tenantId,
});

// 30-day account clients are invoiced in Zoho Books, not Stripe. Their
// charges (the monthly run, an annual term, assisted onboarding) are kept
// as a statement per month; QuipTech exports the month-end report, invoices
// it in Zoho, and records the Zoho invoice and the payment here. Nothing in
// this service talks to Stripe.
@Injectable()
export class StatementsService {
  private readonly logger = new Logger(StatementsService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingConfig: BillingConfigService,
    private readonly notifier: BillingNotifier,
  ) {}

  // True when the account is invoiced in Zoho (an approved 30-day account):
  // nothing for it may be sent to Stripe.
  isZohoBilled = async (
    billingAccountId: string,
    database: Pick<ServiceDatabaseService, 'query'> = this.serviceDatabase,
  ): Promise<boolean> => {
    const terms = await findAccountTerms(database, billingAccountId);
    return terms ? usesAccountTerms(terms) : false;
  };

  // Adds charges to the account's statement for the month, or the first
  // later month still open when that one is already locked. Returns the
  // statement's id. markRun: these are the month's machine charges from the
  // billing run.
  addCharges = async (
    client: PoolClient,
    actor: BillingActor | null,
    params: {
      billingAccountId: string;
      periodStart: string;
      lines: CalculatedLine[];
      reason: string;
      markRun?: boolean;
    },
  ): Promise<string> => {
    const terms = await findAccountTerms(client, params.billingAccountId);
    if (!terms) throw new NotFoundException('Billing account not found.');
    let month = firstDayOfMonth(params.periodStart);
    for (let step = 0; step < MAX_MONTHS_AHEAD; step++) {
      const statement = await this.openStatementFor(client, terms, month);
      if (!statement) {
        month = firstDayOfNextMonth(month);
        continue;
      }
      await repository.appendStatementLines(client, statement.id, params.lines);
      const lines = (
        await repository.listStatementLines(client, [statement.id])
      ).get(statement.id);
      const totals = calculateStatementTotals(lines ?? []);
      await repository.saveStatementTotals(client, statement.id, totals, {
        markRun: params.markRun,
      });
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_statement',
        entityId: statement.id,
        billingAccountId: params.billingAccountId,
        from: { subtotalExGstCents: Number(statement.subtotal_ex_gst_cents) },
        to: { subtotalExGstCents: totals.subtotalExGstCents, month },
        reason: params.reason,
        metadata: { lineCount: params.lines.length },
      });
      return statement.id;
    }
    throw new ConflictException(
      'No open statement month to add this charge to.',
    );
  };

  // The month's draft statement, made if there isn't one; null when the
  // month is locked or its statement has moved on.
  private openStatementFor = async (
    client: PoolClient,
    terms: NonNullable<Awaited<ReturnType<typeof findAccountTerms>>>,
    month: string,
  ) => {
    if (await repository.isMonthLocked(client, month)) return null;
    const existing = await repository.lockStatementForMonth(
      client,
      terms.id,
      month,
    );
    if (existing) return existing.status === 'draft' ? existing : null;
    return repository.insertStatement(client, {
      billingAccountId: terms.id,
      periodStart: month,
      periodEnd: firstDayOfNextMonth(month),
      poNumber: terms.default_po_number,
      termsDays: terms.terms_days,
      formatReference: (sequence) => formatStatementReference(month, sequence),
    });
  };

  // ── Month-end report ─────────────────────────────────────────────────

  report = async (
    filters: {
      month: string;
      paymentType: string | null;
      status: StatementStatus | null;
    },
    now = new Date(),
  ): Promise<MonthEndReport> => {
    const month = toMonthStart(filters.month);
    const rows = await repository.listReportRows(this.serviceDatabase, {
      periodStart: month,
      paymentType: filters.paymentType,
      status: filters.status,
    });
    const lines = await repository.listStatementLines(
      this.serviceDatabase,
      rows.map((row) => row.id),
    );
    const reportRows = rows.map((row): MonthEndReportRow => {
      const statementLines = lines.get(row.id) ?? [];
      const promo = statementLines.find(
        (line) => line.lineType === 'PROMO_DISCOUNT',
      );
      const today = toBillingDay(now, row.timezone);
      return {
        statementId: row.id,
        reference: row.reference,
        billingAccountId: row.billing_account_id,
        organisationName: row.account_name,
        legalName: row.legal_name,
        abn: row.abn,
        accountsEmail: row.accounts_email ?? row.billing_email,
        poNumber: row.po_number,
        paymentType: row.payment_type,
        billingMonth: row.period_start,
        promoCode:
          typeof promo?.calcSnapshot.promoCode === 'string'
            ? promo.calcSnapshot.promoCode
            : null,
        ...summariseStatementLines(statementLines),
        subtotalExGstCents: Number(row.subtotal_ex_gst_cents),
        gstCents: Number(row.gst_cents),
        totalIncGstCents: Number(row.total_inc_gst_cents),
        status: row.status,
        termsDays: row.terms_days ?? row.account_terms_days,
        zohoInvoiceNumber: row.zoho_invoice_number,
        zohoInvoiceDate: row.zoho_invoice_date,
        dueOn: row.due_on,
        paidOn: row.paid_on,
        paidReference: row.paid_reference,
        daysOverdue: daysOverdue(
          { status: row.status, dueOn: row.due_on },
          today,
        ),
        lines: statementLines,
      };
    });
    const lock = await repository.findMonthLock(this.serviceDatabase, month);
    return {
      month,
      locked: Boolean(lock),
      lockedAt: lock?.locked_at.toISOString() ?? null,
      rows: reportRows,
      totals: reportRows.reduce(
        (sum, row) => ({
          subtotalExGstCents: sum.subtotalExGstCents + row.subtotalExGstCents,
          gstCents: sum.gstCents + row.gstCents,
          totalIncGstCents: sum.totalIncGstCents + row.totalIncGstCents,
        }),
        { subtotalExGstCents: 0, gstCents: 0, totalIncGstCents: 0 },
      ),
    };
  };

  machines = async (statementId: string): Promise<StatementMachine[]> => {
    const statement = await this.requireStatement(statementId);
    const rows = await repository.listStatementMachineIntervals(
      this.serviceDatabase,
      statement.billing_account_id,
      statement.period_start,
      statement.period_end,
    );
    const byMachine = new Map<
      string,
      StatementMachine & {
        intervals: { activatedOn: string; billingEnd: string | null }[];
      }
    >();
    for (const row of rows) {
      const machine = byMachine.get(row.machine_id) ?? {
        machineId: row.machine_id,
        plantId: row.plant_id,
        manufacturer: row.manufacturer,
        model: row.model,
        serialNumber: row.serial_number,
        activeDays: 0,
        deleted: row.deleted,
        intervals: [],
      };
      machine.intervals.push({
        activatedOn: row.activated_on,
        billingEnd: row.billing_end,
      });
      byMachine.set(row.machine_id, machine);
    }
    return [...byMachine.values()].map(({ intervals, ...machine }) => ({
      ...machine,
      activeDays: countActiveDays(
        intervals,
        statement.period_start,
        statement.period_end,
      ),
    }));
  };

  export = async (
    filters: {
      month: string;
      paymentType: string | null;
      status: StatementStatus | null;
    },
    format: ExportFormat,
    invoiceDate: string | null,
  ): Promise<ExportFile> => {
    const report = await this.report(filters);
    const monthLabel = report.month.slice(0, 7);
    if (format === 'zoho') {
      const table = buildZohoTable(
        report.rows,
        invoiceDate ?? firstDayOfNextMonth(report.month),
      );
      return {
        filename: `field-zoho-invoices-${monthLabel}.csv`,
        contentType: 'text/csv; charset=utf-8',
        body: toCsv(table),
      };
    }
    const table = buildReportTable(report.rows);
    if (format === 'xlsx')
      return {
        filename: `field-month-end-${monthLabel}.xlsx`,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: toXlsx(table, `Month end ${monthLabel}`),
      };
    return {
      filename: `field-month-end-${monthLabel}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: toCsv(table),
    };
  };

  // ── Tracking ─────────────────────────────────────────────────────────

  // Locks the month: every draft statement becomes ready, and charges made
  // from now on go on next month's statement. Only once the month is over.
  markMonthReady = async (
    actor: AuthenticatedUser,
    monthInput: string,
    now = new Date(),
  ): Promise<{ month: string; lockedCount: number }> => {
    const month = toMonthStart(monthInput);
    const config = await this.billingConfig.loadConfig();
    const currentMonth = firstDayOfMonth(
      toBillingDay(now, config.DEFAULT_BILLING_TIMEZONE),
    );
    if (month >= currentMonth) throw new ConflictException(MONTH_OPEN_MESSAGE);
    return this.serviceDatabase.transaction(async (client) => {
      const result = await repository.lockMonth(client, month, actor.userId);
      const statements = await repository.listReportRows(client, {
        periodStart: month,
        paymentType: null,
        status: 'ready',
      });
      for (const statement of statements) {
        await recordBillingAudit(client, toActor(actor), {
          action: 'update',
          entityType: 'billing_statement',
          entityId: statement.id,
          billingAccountId: statement.billing_account_id,
          from: { status: 'draft' },
          to: { status: 'ready' },
          reason: 'month marked as ready',
        });
      }
      return { month, lockedCount: result.lockedCount };
    });
  };

  setZohoInvoice = async (
    actor: AuthenticatedUser,
    statementId: string,
    input: {
      invoiceNumber: string;
      invoiceDate: string;
      termsDays: number | null;
    },
  ): Promise<MonthEndReportRow> => {
    await this.serviceDatabase.transaction(async (client) => {
      const statement = await this.lockOrThrow(client, statementId);
      if (!canSetZohoInvoice(statement.status))
        throw new ConflictException(
          statement.status === 'draft'
            ? NOT_READY_MESSAGE
            : `This statement is ${statement.status}.`,
        );
      const termsDays =
        input.termsDays ??
        statement.terms_days ??
        (await findAccountTerms(client, statement.billing_account_id))
          ?.terms_days ??
        30;
      const dueOn = calculateDueOn(input.invoiceDate, termsDays);
      await repository.setZohoInvoice(client, {
        statementId,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        termsDays,
        dueOn,
        userId: actor.userId,
      });
      await recordBillingAudit(client, toActor(actor), {
        action: 'update',
        entityType: 'billing_statement',
        entityId: statementId,
        billingAccountId: statement.billing_account_id,
        from: {
          status: statement.status,
          zohoInvoiceNumber: statement.zoho_invoice_number,
        },
        to: {
          status: 'invoiced_external',
          zohoInvoiceNumber: input.invoiceNumber,
          zohoInvoiceDate: input.invoiceDate,
          dueOn,
        },
        reason: 'invoiced in Zoho',
      });
    });
    return this.reportRow(statementId);
  };

  markPaid = async (
    actor: AuthenticatedUser,
    statementId: string,
    input: { paidOn: string; reference: string | null },
  ): Promise<MonthEndReportRow> => {
    await this.serviceDatabase.transaction(async (client) => {
      const statement = await this.lockOrThrow(client, statementId);
      if (!canMarkPaid(statement.status))
        throw new ConflictException(
          statement.status === 'paid'
            ? 'This statement is already paid.'
            : NOT_INVOICED_MESSAGE,
        );
      if (
        statement.zoho_invoice_date &&
        input.paidOn < statement.zoho_invoice_date
      )
        throw new BadRequestException(
          'The payment date is before the Zoho invoice date.',
        );
      await repository.markStatementPaid(client, {
        statementId,
        paidOn: input.paidOn,
        reference: input.reference,
        userId: actor.userId,
      });
      await recordBillingAudit(client, toActor(actor), {
        action: 'update',
        entityType: 'billing_statement',
        entityId: statementId,
        billingAccountId: statement.billing_account_id,
        from: { status: statement.status },
        to: {
          status: 'paid',
          paidOn: input.paidOn,
          reference: input.reference,
        },
        reason: 'payment received',
      });
    });
    return this.reportRow(statementId);
  };

  voidStatement = async (
    actor: AuthenticatedUser,
    statementId: string,
    reason: string,
  ): Promise<void> => {
    await this.serviceDatabase.transaction(async (client) => {
      const statement = await this.lockOrThrow(client, statementId);
      if (!canVoid(statement.status))
        throw new ConflictException(CANNOT_VOID_MESSAGE);
      await repository.voidStatement(client, statementId, reason);
      await recordBillingAudit(client, toActor(actor), {
        action: 'update',
        entityType: 'billing_statement',
        entityId: statementId,
        billingAccountId: statement.billing_account_id,
        from: { status: statement.status },
        to: { status: 'void' },
        reason,
      });
    });
  };

  // ── The organisation's own statements ───────────────────────────────

  listForOrganisation = async (
    actor: AuthenticatedUser,
    now = new Date(),
  ): Promise<OrganisationStatement[]> => {
    const account = await this.serviceDatabase.query<{
      billing_account_id: string | null;
      timezone: string | null;
    }>(
      `SELECT t.billing_account_id, a.timezone FROM tenants t
       LEFT JOIN billing.billing_accounts a ON a.id = t.billing_account_id
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [actor.tenantId],
    );
    const row = account.rows[0];
    if (!row?.billing_account_id)
      throw new NotFoundException(NO_ORGANISATION_ACCOUNT_MESSAGE);
    const statements = await repository.listAccountStatements(
      this.serviceDatabase,
      row.billing_account_id,
    );
    const lines = await repository.listStatementLines(
      this.serviceDatabase,
      statements.map((statement) => statement.id),
    );
    const today = toBillingDay(now, row.timezone ?? 'UTC');
    return statements.map((statement) => ({
      id: statement.id,
      reference: statement.reference,
      billingMonth: statement.period_start,
      status: statement.status,
      subtotalExGstCents: Number(statement.subtotal_ex_gst_cents),
      gstCents: Number(statement.gst_cents),
      totalIncGstCents: Number(statement.total_inc_gst_cents),
      zohoInvoiceNumber: statement.zoho_invoice_number,
      zohoInvoiceDate: statement.zoho_invoice_date,
      dueOn: statement.due_on,
      paidOn: statement.paid_on,
      overdue: isOverdue(
        { status: statement.status, dueOn: statement.due_on },
        today,
      ),
      lines: (lines.get(statement.id) ?? []).map((line) => ({
        description: line.description,
        amountCents: line.amountCents,
      })),
    }));
  };

  // ── Reminders and overdue ───────────────────────────────────────────

  // Reminders on INVOICE_REMINDER_OFFSET_DAYS around the Zoho due date (the
  // Zoho invoice date + terms). Platform administrators always; the client
  // only with STATEMENT_REMINDERS_EMAIL_CLIENT. The reminders sent.
  sendDueReminders = async (now: Date): Promise<number> => {
    const config = await this.billingConfig.loadConfig();
    const offsets = config.INVOICE_REMINDER_OFFSET_DAYS;
    if (!offsets.length) return 0;
    const statements = await repository.listStatementsForReminders(
      this.serviceDatabase,
      reminderLeadDays(offsets),
    );
    let sent = 0;
    for (const statement of statements) {
      if (!statement.due_on) continue;
      const today = toBillingDay(now, statement.timezone);
      const offsetDays = findReminderDue({
        dueOn: statement.due_on,
        today,
        offsets,
        sentOffsets: statement.sent_offsets.map(Number),
        collectionMethod: 'send_invoice',
      });
      if (offsetDays === null) continue;
      try {
        if (
          !(await repository.recordStatementReminder(
            this.serviceDatabase,
            statement.id,
            offsetDays,
          ))
        )
          continue;
        const daysFromDue = daysBetween(statement.due_on, today);
        await this.notifier.notifyPlatformAdmins(
          describeAdminReminder(statement, daysFromDue),
        );
        if (config.STATEMENT_REMINDERS_EMAIL_CLIENT) {
          const notice = describeClientReminder(statement, daysFromDue);
          await this.notifier.emailBillingContact(
            statement.billing_email,
            notice,
          );
          if (
            statement.accounts_email &&
            statement.accounts_email.toLowerCase() !==
              statement.billing_email.toLowerCase()
          )
            await this.notifier.emailBillingContact(
              statement.accounts_email,
              notice,
            );
        }
        sent++;
      } catch (error) {
        this.logger.error(
          `Reminder for statement ${statement.id} failed: ${String(error)}`,
        );
      }
    }
    return sent;
  };

  listOverdue = async () =>
    (await repository.listOverdueStatements(this.serviceDatabase)).map(
      (row) => ({
        statementId: row.id,
        reference: row.reference,
        billingAccountId: row.billing_account_id,
        accountName: row.account_name,
        paymentType: row.payment_type,
        billingMonth: row.period_start,
        zohoInvoiceNumber: row.zoho_invoice_number,
        zohoInvoiceDate: row.zoho_invoice_date,
        dueOn: row.due_on as string,
        daysOverdue: Number(row.days_overdue),
        outstandingCents: Number(row.total_inc_gst_cents),
        lastReminderOffset: row.last_reminder_offset,
        suspended: row.suspended_at !== null,
      }),
    );

  private reportRow = async (statementId: string) => {
    const statement = await this.requireStatement(statementId);
    const report = await this.report({
      month: statement.period_start,
      paymentType: null,
      status: statement.status,
    });
    const row = report.rows.find((item) => item.statementId === statementId);
    if (!row) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return row;
  };

  private requireStatement = async (statementId: string) => {
    const statement = await repository.findStatement(
      this.serviceDatabase,
      statementId,
    );
    if (!statement) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return statement;
  };

  private lockOrThrow = async (client: PoolClient, statementId: string) => {
    const statement = await repository.lockStatement(client, statementId);
    if (!statement) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return statement;
  };
}

const plural = (days: number) => `${days} day${days === 1 ? '' : 's'}`;
const monthName = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-AU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

const describeWhen = (dueOn: string, daysFromDue: number) =>
  daysFromDue < 0
    ? `is due on ${dueOn}, in ${plural(-daysFromDue)}`
    : daysFromDue === 0
      ? `is due today (${dueOn})`
      : `was due on ${dueOn} and is ${plural(daysFromDue)} overdue`;

const describeAdminReminder = (
  statement: repository.ReminderStatementRow,
  daysFromDue: number,
): BillingNotice => ({
  title:
    daysFromDue > 0
      ? `Zoho invoice ${plural(daysFromDue)} overdue`
      : 'Zoho invoice due soon',
  body: `${statement.account_name}: Zoho invoice ${statement.zoho_invoice_number} (${statement.reference}, ${monthName(statement.period_start)}) for ${formatCents(Number(statement.total_inc_gst_cents), 'AUD')} inc GST ${describeWhen(statement.due_on as string, daysFromDue)}.`,
  link: ADMIN_LINK,
});

const describeClientReminder = (
  statement: repository.ReminderStatementRow,
  daysFromDue: number,
): BillingNotice => ({
  title:
    daysFromDue > 0
      ? `Invoice ${plural(daysFromDue)} overdue`
      : 'Invoice due soon',
  body: `Your QuipTech invoice ${statement.zoho_invoice_number} for FIELD (${monthName(statement.period_start)}) for ${formatCents(Number(statement.total_inc_gst_cents), 'AUD')} inc GST ${describeWhen(statement.due_on as string, daysFromDue)}. Please contact QuipTech accounts if you have any questions.`,
  link: ORGANISATION_LINK,
});
