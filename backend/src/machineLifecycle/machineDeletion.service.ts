import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import {
  addDaysToDay,
  firstDayOfNextMonth,
  toBillingDay,
} from '../billing/billingCalendar/billingDay';
import { UpFrontInvoiceService } from '../billing/invoices/upFrontInvoice.service';
import {
  hasRunInvoice,
  MACHINE_FINAL_INVOICE_KIND,
} from '../billing/monthlyRun/runInvoices.repository';
import { findBandRateCents } from '../billing/pricing/fleetPrice';
import { PriceBooksService } from '../billing/priceBooks/priceBooks.service';
import { PLAN_CODES } from '../billing/subscriptions/planCodes';
import { listLiveSubscriptions } from '../billing/subscriptions/subscriptions.repository';
import { DatabaseService } from '../database/database.service';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import { disconnectMachineApp } from '../machineControl/pairing/machineAppPairing.repository';
import { toLifecycleState } from './lifecycleTransitions';
import { findPeakSoFar } from './machineActivations.repository';
import * as deletionRepository from './machineDeletion.repository';
import {
  assessMachineDeletion,
  billedMonthRange,
  BillingIntervalUse,
  FinalChargeDue,
  FinalChargeQuote,
  MachineDeletionCheck,
  quoteFinalCharge,
} from './machineDeletionRules';
import { LifecycleMachineRow } from './machineLifecycle.repository';
import { findVisibleLifecycleMachine } from './visibleMachine';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const STATE_CHANGED_MESSAGE =
  'This machine changed while you were working on it. Refresh and try again.';
const FALLBACK_TIME_ZONE = 'UTC';
const NO_PRICE_MESSAGE =
  "This machine's plan has no price to charge. Contact support.";
const NOTHING_TO_PAY_MESSAGE =
  "This machine doesn't have a final charge to pay.";

export type FinalChargePayment = MachineDeletionCheck & {
  paymentUrl: string | null;
};

const formatRate = (cents: number) => `A$${(cents / 100).toFixed(2)}`;
const formatMonth = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-AU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

// Deleting a machine: only the owning organisation, once it's out of active and
// its billing is settled (machineDeletionRules.ts). A soft delete: the machine
// leaves every read, and its records, activation intervals and invoices stay.
@Injectable()
export class MachineDeletionService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly priceBooks: PriceBooksService,
    private readonly upFrontInvoices: UpFrontInvoiceService,
  ) {}

  checkDeletion = async (
    actor: AuthenticatedUser,
    machineId: string,
    now = new Date(),
  ): Promise<MachineDeletionCheck> => {
    const { check, machine, intervals, today } = await this.readCheck(
      actor,
      machineId,
      now,
    );
    if (check.blocker === 'unpaid_invoices') {
      // Back from paying: Stripe may know before its webhook has told us.
      const onStripe = check.unpaidInvoices
        .filter((invoice) => invoice.hostedInvoiceUrl)
        .map((invoice) => invoice.id);
      const viaCheckout = check.unpaidInvoices
        .filter((invoice) => invoice.isFinalCharge && !invoice.hostedInvoiceUrl)
        .map((invoice) => invoice.id);
      const isAnyPaid =
        (await this.upFrontInvoices.refreshPaid(onStripe)) ||
        (machine.billing_account_id !== null &&
          (await this.upFrontInvoices.confirmCheckouts(
            viaCheckout,
            machine.billing_account_id,
          )));
      return isAnyPaid ? this.checkDeletion(actor, machineId, now) : check;
    }
    if (check.blocker !== 'final_charge_due') return check;
    return {
      ...check,
      finalCharge: await this.quote(machine, intervals, check.monthsDue, today),
    };
  };

  // Raises the machine's final charge (the total of what's due) and opens
  // Stripe Checkout to pay it: paymentUrl is where to send the payer, who
  // comes back to returnPage. Null once nothing is left to pay here. If Stripe
  // fails they get the error, and the invoice stays saved. Safe to repeat: a
  // second call finds the first charge and its open Checkout.
  payFinalCharge = async (
    actor: AuthenticatedUser,
    machineId: string,
    returnPage: string,
    now = new Date(),
  ): Promise<FinalChargePayment> => {
    const { check, machine, intervals, today, label } = await this.readCheck(
      actor,
      machineId,
      now,
    );
    if (check.blocker === 'unpaid_invoices') {
      return this.openPayment(actor, machineId, label, returnPage, now);
    }
    if (check.blocker !== 'final_charge_due') {
      if (check.canDelete) return { ...check, paymentUrl: null };
      throw new ConflictException({
        statusCode: 409,
        code: check.blocker,
        message: check.message ?? NOTHING_TO_PAY_MESSAGE,
      });
    }
    const billingAccountId = machine.billing_account_id;
    if (!billingAccountId) throw new ConflictException(NOTHING_TO_PAY_MESSAGE);
    const { months } = await this.quote(
      machine,
      intervals,
      check.monthsDue,
      today,
    );
    const book = await this.pinnedBook(billingAccountId);
    // The invoice is found again by openPayment, with any raised earlier.
    await this.serviceDatabase.transaction(async (client) => {
      await deletionRepository.lockAccountBilling(client, billingAccountId);
      // The run may have invoiced a month since the check: charging it here
      // too would bill it twice.
      const toCharge: FinalChargeQuote[] = [];
      for (const month of months) {
        if (await hasRunInvoice(client, billingAccountId, month.periodStart)) {
          throw new ConflictException(STATE_CHANGED_MESSAGE);
        }
        const isCharged = await deletionRepository.hasLiveFinalCharge(
          client,
          machineId,
          month.periodStart,
        );
        if (!isCharged) toCharge.push(month);
      }
      if (toCharge.length === 0) return null;
      const invoice = await this.upFrontInvoices.draft(client, actor, {
        billingAccountId,
        kind: MACHINE_FINAL_INVOICE_KIND,
        periodStart: toCharge[0].periodStart,
        periodEnd: firstDayOfNextMonth(
          toCharge[toCharge.length - 1].periodStart,
        ),
        reason: 'final charge for a machine being deleted',
        lines: toCharge.map((month) => ({
          lineType: 'ASSET_PRO_FINAL_DAYS',
          description: `Final charge for ${label}: ${month.daysUsed} of ${month.daysInMonth} days in ${formatMonth(month.periodStart)} at ${formatRate(month.monthlyRateCents)} a month`,
          // invoice_lines needs amount = quantity × unit: a daily rate
          // wouldn't round to the same total, so this is one final charge.
          quantity: 1,
          unitCents: month.amountCents,
          amountCents: month.amountCents,
          calcSnapshot: {
            formula: 'ASSET_PRO_FINAL_DAYS',
            subscriptionId: null,
            periodStart: month.periodStart,
            periodEnd: firstDayOfNextMonth(month.periodStart),
            peak: 0,
            peakDay: null,
            priceBookId: book.id,
            priceBookVersion: book.version,
            bands: book.bands,
            seatCents: null,
            committedQty: null,
            monthsCharged: null,
            machineId,
            monthlyRateCents: month.monthlyRateCents,
            daysUsed: month.daysUsed,
            daysInMonth: month.daysInMonth,
          },
        })),
      });
      for (const month of toCharge) {
        await deletionRepository.insertFinalCharge(client, {
          machineId,
          billingAccountId,
          invoiceId: invoice,
          quote: month,
        });
      }
      return invoice;
    });
    return this.openPayment(actor, machineId, label, returnPage, now);
  };

  // The payment page for the machine's unpaid final charge: its Stripe
  // invoice page if an earlier push made one, otherwise Checkout. Monthly
  // invoices are paid from Billing, so they get none here.
  private openPayment = async (
    actor: AuthenticatedUser,
    machineId: string,
    label: string,
    returnPage: string,
    now: Date,
  ): Promise<FinalChargePayment> => {
    const check = await this.checkDeletion(actor, machineId, now);
    const finalCharge = check.unpaidInvoices.find(
      (invoice) => invoice.isFinalCharge,
    );
    if (!finalCharge) return { ...check, paymentUrl: null };
    if (finalCharge.hostedInvoiceUrl) {
      return { ...check, paymentUrl: finalCharge.hostedInvoiceUrl };
    }
    const paymentUrl = await this.upFrontInvoices.openCheckout(finalCharge.id, {
      returnPage,
      keyScope: returnPage,
      description: `Final charge for ${label}`,
    });
    // Null: Checkout was already paid, and is now recorded.
    return paymentUrl
      ? { ...check, paymentUrl }
      : { ...(await this.checkDeletion(actor, machineId, now)), paymentUrl };
  };

  // Checked again inside the transaction, whatever the screen showed.
  deleteMachine = (
    actor: AuthenticatedUser,
    machineId: string,
    reason: string,
    now = new Date(),
  ): Promise<void> =>
    this.databaseService.withActor(actor, async (client) => {
      const machine = await this.requireMachine(client, actor, machineId);
      const { check } = await this.assess(client, actor, machine, now);
      if (!check.canDelete) {
        throw new ConflictException({
          statusCode: 409,
          code: check.blocker,
          message: check.message,
        });
      }
      const appDisconnected = await disconnectMachineApp(client, machineId);
      const deleted = await deletionRepository.softDeleteMachine(client, {
        tenantId: actor.tenantId,
        machineId,
        lifecycleState: machine.lifecycle_state,
      });
      if (!deleted) throw new ConflictException(STATE_CHANGED_MESSAGE);
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'delete',
        entityType: 'machine',
        entityId: machineId,
        metadata: {
          reason,
          lifecycleState: machine.lifecycle_state,
          appDisconnected,
        },
      });
    });

  private requireMachine = async (
    client: PoolClient,
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<LifecycleMachineRow> => {
    const machine = await findVisibleLifecycleMachine(client, actor, machineId);
    if (!machine) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
    return machine;
  };

  private readCheck = (
    actor: AuthenticatedUser,
    machineId: string,
    now: Date,
  ) =>
    this.databaseService.withActor(actor, async (client) => {
      const machine = await this.requireMachine(client, actor, machineId);
      return {
        machine,
        label: await deletionRepository.findMachineLabel(client, machineId),
        ...(await this.assess(client, actor, machine, now)),
      };
    });

  private assess = async (
    client: PoolClient,
    actor: AuthenticatedUser,
    machine: LifecycleMachineRow,
    now: Date,
  ) => {
    const timezone = machine.timezone ?? FALLBACK_TIME_ZONE;
    const today = toBillingDay(now, timezone);
    const intervals = await deletionRepository.listBillingIntervals(
      client,
      machine.id,
      timezone,
    );
    const range = billedMonthRange(intervals, today);
    const check = assessMachineDeletion({
      state: toLifecycleState(machine.lifecycle_state),
      today,
      openCaseCount: await deletionRepository.countOpenCases(
        client,
        actor.tenantId,
        machine.id,
      ),
      hasPendingTransfer: await deletionRepository.hasPendingTransfer(
        client,
        machine.id,
      ),
      plan: await deletionRepository.findMachinePlanBilling(client),
      intervals,
      invoices: range
        ? await deletionRepository.listSettlementInvoices(
            client,
            machine.id,
            range.firstMonth,
            range.lastMonth,
          )
        : [],
      finalChargedMonths: range
        ? await deletionRepository.listFinalChargedMonths(client, machine.id)
        : [],
      runPassedLastClosedMonth: range
        ? await deletionRepository.hasDailySnapshot(
            client,
            range.firstDayAfterClosed,
          )
        : false,
    });
    return { check, intervals, today };
  };

  // Each month's rate is the band for the account's peak that month, so far if
  // it's still open.
  private quote = async (
    machine: LifecycleMachineRow,
    intervals: BillingIntervalUse[],
    months: string[],
    today: string,
  ): Promise<FinalChargeDue> => {
    const billingAccountId = machine.billing_account_id;
    if (!billingAccountId) throw new ConflictException(NOTHING_TO_PAY_MESSAGE);
    const book = await this.pinnedBook(billingAccountId);
    const quotes = await this.serviceDatabase.transaction(async (client) => {
      const results: FinalChargeQuote[] = [];
      for (const month of months) {
        const lastDay = addDaysToDay(firstDayOfNextMonth(month), -1);
        const peak = await findPeakSoFar(
          client,
          billingAccountId,
          month,
          lastDay < today ? lastDay : today,
        );
        results.push(
          quoteFinalCharge(
            intervals,
            month,
            findBandRateCents(book.bands, Math.max(peak, 1)),
          ),
        );
      }
      return results;
    });
    return {
      amountCents: quotes.reduce((sum, month) => sum + month.amountCents, 0),
      months: quotes,
    };
  };

  private pinnedBook = async (billingAccountId: string) => {
    const subscriptions = await listLiveSubscriptions(
      this.serviceDatabase,
      billingAccountId,
    );
    const assetPro = subscriptions.find(
      (item) => item.plan_code === PLAN_CODES.assetPro,
    );
    if (!assetPro) throw new ConflictException(NO_PRICE_MESSAGE);
    return this.priceBooks.getPinnedPriceBook(assetPro.price_book_id);
  };
}
