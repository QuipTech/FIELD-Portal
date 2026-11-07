import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import {
  firstDayOfMonth,
  firstDayOfNextMonth,
  toBillingDay,
} from '../billing/billingCalendar/billingDay';
import { UpFrontInvoiceService } from '../billing/invoices/upFrontInvoice.service';
import { MACHINE_FINAL_INVOICE_KIND } from '../billing/monthlyRun/runInvoices.repository';
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

const formatRate = (cents: number) => `A$${(cents / 100).toFixed(2)}`;

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
    if (check.blocker !== 'final_charge_due') return check;
    return {
      ...check,
      finalCharge: await this.quote(machine, intervals, today),
    };
  };

  // Raises the machine's final charge and pushes it to Stripe, which charges a
  // card or direct debit on file at once; otherwise the customer pays the
  // invoice link shown on the machine. The answer shows where that leaves it.
  // Safe to repeat: a second call finds the first charge.
  payFinalCharge = async (
    actor: AuthenticatedUser,
    machineId: string,
    now = new Date(),
  ): Promise<MachineDeletionCheck> => {
    const { check, machine, intervals, today, label } = await this.readCheck(
      actor,
      machineId,
      now,
    );
    if (check.blocker !== 'final_charge_due') {
      if (check.blocker === 'unpaid_invoices' || check.canDelete) return check;
      throw new ConflictException({
        statusCode: 409,
        code: check.blocker,
        message: check.message ?? NOTHING_TO_PAY_MESSAGE,
      });
    }
    const billingAccountId = machine.billing_account_id;
    if (!billingAccountId) throw new ConflictException(NOTHING_TO_PAY_MESSAGE);
    const quote = await this.quote(machine, intervals, today);
    const book = await this.pinnedBook(billingAccountId);
    const invoiceId = await this.serviceDatabase.transaction(async (client) => {
      await deletionRepository.lockAccountBilling(client, billingAccountId);
      if (
        await deletionRepository.hasLiveFinalCharge(
          client,
          machineId,
          quote.periodStart,
        )
      )
        return null;
      const invoice = await this.upFrontInvoices.draft(client, actor, {
        billingAccountId,
        kind: MACHINE_FINAL_INVOICE_KIND,
        periodStart: quote.periodStart,
        periodEnd: firstDayOfNextMonth(today),
        reason: 'final charge for a machine being deleted',
        lines: [
          {
            lineType: 'ASSET_PRO_FINAL_DAYS',
            description: `Final charge for ${label}: ${quote.daysUsed} of ${quote.daysInMonth} days at ${formatRate(quote.monthlyRateCents)} a month`,
            // invoice_lines needs amount = quantity × unit: a daily rate
            // wouldn't round to the same total, so this is one final charge.
            quantity: 1,
            unitCents: quote.amountCents,
            amountCents: quote.amountCents,
            calcSnapshot: {
              formula: 'ASSET_PRO_FINAL_DAYS',
              subscriptionId: null,
              periodStart: quote.periodStart,
              periodEnd: firstDayOfNextMonth(today),
              peak: 0,
              peakDay: null,
              priceBookId: book.id,
              priceBookVersion: book.version,
              bands: book.bands,
              seatCents: null,
              committedQty: null,
              monthsCharged: null,
              machineId,
              monthlyRateCents: quote.monthlyRateCents,
              daysUsed: quote.daysUsed,
              daysInMonth: quote.daysInMonth,
            },
          },
        ],
      });
      await deletionRepository.insertFinalCharge(client, {
        machineId,
        billingAccountId,
        invoiceId: invoice,
        quote,
      });
      return invoice;
    });
    if (invoiceId) {
      await this.upFrontInvoices.finalise(invoiceId, billingAccountId);
    }
    return this.checkDeletion(actor, machineId, now);
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
      runPassedLastClosedMonth: range
        ? await deletionRepository.hasDailySnapshot(
            client,
            range.firstDayAfterClosed,
          )
        : false,
    });
    return { check, intervals, today };
  };

  // The rate is the band for the account's peak so far this month.
  private quote = async (
    machine: LifecycleMachineRow,
    intervals: BillingIntervalUse[],
    today: string,
  ): Promise<FinalChargeQuote> => {
    const billingAccountId = machine.billing_account_id;
    if (!billingAccountId) throw new ConflictException(NOTHING_TO_PAY_MESSAGE);
    const book = await this.pinnedBook(billingAccountId);
    const peak = await this.serviceDatabase.transaction((client) =>
      findPeakSoFar(client, billingAccountId, firstDayOfMonth(today), today),
    );
    return quoteFinalCharge(
      intervals,
      today,
      findBandRateCents(book.bands, Math.max(peak, 1)),
    );
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
