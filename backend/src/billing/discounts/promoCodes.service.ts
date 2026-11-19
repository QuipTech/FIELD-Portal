import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import * as termsRepository from '../accountTerms/accountTerms.repository';
import { recordBillingAudit } from '../billingAudit/billingAudit';
import { toBillingDay } from '../billingCalendar/billingDay';
import { PromoTerms } from './discountRules';
import {
  describePromo,
  findRedemptionProblem,
  isRedemptionCurrent,
  normaliseCode,
  PROMO_ERROR_MESSAGES,
  PromoErrorCode,
  redemptionMonths,
} from './promoCodeRules';
import * as promoRepository from './promoCodes.repository';
import {
  PromoCodeInput,
  PromoCodeRow,
  RedemptionRow,
} from './promoCodes.repository';

const UNIQUE_VIOLATION_CODE = '23505';
const NOT_FOUND_MESSAGE = 'Promo code not found.';
const NO_ACCOUNT_MESSAGE =
  'Your organisation has no billing account yet. It is set up when your organisation signs up.';
const DUPLICATE_MESSAGE = 'A promo code with that code already exists.';
const PERCENT_TOO_HIGH_MESSAGE = 'A percentage discount is at most 100.';
const DATES_REVERSED_MESSAGE =
  'The code must start on or before the day it expires.';
const TERMS_LOCKED_MESSAGE =
  'This code has been redeemed, so its discount and length can no longer change. Deactivate it and create a new one instead.';

export interface PromoCode {
  id: string;
  code: string;
  description: string;
  discountType: PromoCodeRow['discount_type'];
  discountValue: number;
  durationMonths: number | null;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  redemptionsCount: number;
  newCustomersOnly: boolean;
  active: boolean;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromoRedemption {
  id: string;
  promoCodeId: string;
  code: string;
  description: string;
  summary: string;
  // So the portal can show what the code takes off a quote.
  discountType: PromoCodeRow['discount_type'];
  discountValue: number;
  billingAccountId: string;
  accountName: string;
  redeemedAt: string;
  startsMonth: string;
  endsMonth: string | null;
}

const toPromoCode = (row: PromoCodeRow): PromoCode => ({
  id: row.id,
  code: row.code,
  description: row.description,
  discountType: row.discount_type,
  discountValue: row.discount_value,
  durationMonths: row.duration_months,
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  maxRedemptions: row.max_redemptions,
  redemptionsCount: row.redemptions_count,
  newCustomersOnly: row.new_customers_only,
  active: row.active,
  summary: describePromo({
    discountType: row.discount_type,
    discountValue: row.discount_value,
    durationMonths: row.duration_months,
  }),
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toRedemption = (row: RedemptionRow): PromoRedemption => ({
  id: row.id,
  promoCodeId: row.promo_code_id,
  code: row.code,
  description: row.description,
  summary: describePromo({
    discountType: row.discount_type,
    discountValue: row.discount_value,
    durationMonths: row.duration_months,
  }),
  discountType: row.discount_type,
  discountValue: row.discount_value,
  billingAccountId: row.billing_account_id,
  accountName: row.account_name,
  redeemedAt: row.redeemed_at.toISOString(),
  startsMonth: row.starts_month,
  endsMonth: row.ends_month,
});

const checkTerms = (input: Omit<PromoCodeInput, 'code'>) => {
  if (input.discountType === 'percent' && input.discountValue > 100)
    throw new BadRequestException(PERCENT_TOO_HIGH_MESSAGE);
  if (input.validFrom && input.validUntil && input.validFrom > input.validUntil)
    throw new BadRequestException(DATES_REVERSED_MESSAGE);
};

const promoError = (code: PromoErrorCode) =>
  new UnprocessableEntityException({
    code,
    message: PROMO_ERROR_MESSAGES[code],
  });

// Promo codes: a platform administrator creates and manages them; an
// organisation admin redeems one. One active promo per account, applied
// after any free period to machine charges only (DiscountService).
@Injectable()
export class PromoCodesService {
  constructor(private readonly serviceDatabase: ServiceDatabaseService) {}

  // ── Platform administrator ───────────────────────────────────────────

  list = async (): Promise<PromoCode[]> =>
    (await promoRepository.listPromoCodes(this.serviceDatabase)).map(
      toPromoCode,
    );

  create = async (
    actor: AuthenticatedUser,
    input: PromoCodeInput,
  ): Promise<PromoCode> => {
    checkTerms(input);
    const code = normaliseCode(input.code);
    try {
      const id = await this.serviceDatabase.transaction(async (client) => {
        const created = await promoRepository.insertPromoCode(
          client,
          { ...input, code },
          actor.userId,
        );
        await recordBillingAudit(client, actor, {
          action: 'create',
          entityType: 'promo_code',
          entityId: created,
          billingAccountId: null,
          from: null,
          to: { ...input, code },
          reason: null,
        });
        return created;
      });
      return this.get(id);
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION_CODE)
        throw new ConflictException(DUPLICATE_MESSAGE);
      throw error;
    }
  };

  update = async (
    actor: AuthenticatedUser,
    promoCodeId: string,
    input: Omit<PromoCodeInput, 'code'>,
  ): Promise<PromoCode> => {
    checkTerms(input);
    await this.serviceDatabase.transaction(async (client) => {
      const before = await promoRepository.findPromoCode(client, promoCodeId);
      if (!before) throw new NotFoundException(NOT_FOUND_MESSAGE);
      const termsChanged =
        before.discount_type !== input.discountType ||
        before.discount_value !== input.discountValue ||
        before.duration_months !== input.durationMonths;
      if (before.redemptions_count > 0 && termsChanged)
        throw new ConflictException(TERMS_LOCKED_MESSAGE);
      await promoRepository.updatePromoCode(client, promoCodeId, input);
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'promo_code',
        entityId: promoCodeId,
        billingAccountId: null,
        from: toPromoCode(before),
        to: input,
        reason: null,
      });
    });
    return this.get(promoCodeId);
  };

  setActive = async (
    actor: AuthenticatedUser,
    promoCodeId: string,
    active: boolean,
  ): Promise<PromoCode> => {
    await this.serviceDatabase.transaction(async (client) => {
      if (
        !(await promoRepository.setPromoCodeActive(client, promoCodeId, active))
      )
        throw new NotFoundException(NOT_FOUND_MESSAGE);
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'promo_code',
        entityId: promoCodeId,
        billingAccountId: null,
        from: { active: !active },
        to: { active },
        reason: active ? 'reactivated' : 'deactivated',
      });
    });
    return this.get(promoCodeId);
  };

  listRedemptions = async (promoCodeId: string): Promise<PromoRedemption[]> => {
    await this.get(promoCodeId);
    return (
      await promoRepository.listRedemptionsForCode(
        this.serviceDatabase,
        promoCodeId,
      )
    ).map(toRedemption);
  };

  // ── Organisation (billing.manage) ────────────────────────────────────

  // What the code would do, or the reason it can't be used.
  validate = async (
    actor: AuthenticatedUser,
    code: string,
    now = new Date(),
  ) => {
    const account = await this.requireOrganisationAccount(actor);
    const today = toBillingDay(now, account.timezone);
    const promo = await promoRepository.findPromoCodeByCode(
      this.serviceDatabase,
      code,
    );
    const problem = await this.findProblem(
      this.serviceDatabase,
      account.id,
      promo,
      today,
    );
    if (problem) throw promoError(problem);
    const live = promo as PromoCodeRow;
    return {
      code: live.code,
      description: live.description,
      summary: toPromoCode(live).summary,
      discountType: live.discount_type,
      discountValue: live.discount_value,
      ...redemptionMonths(today, live.duration_months),
    };
  };

  redeem = async (
    actor: AuthenticatedUser,
    code: string,
    now = new Date(),
  ): Promise<PromoRedemption> => {
    const account = await this.requireOrganisationAccount(actor);
    const today = toBillingDay(now, account.timezone);
    const redemptionId = await this.serviceDatabase.transaction(
      async (client) => {
        // One redemption at a time per account, so two admins can't each add
        // a promo; the code row is locked so it can't be over-redeemed.
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [`promo-redemption:${account.id}`],
        );
        const promo = await promoRepository.findPromoCodeByCode(
          client,
          code,
          true,
        );
        const problem = await this.findProblem(
          client,
          account.id,
          promo,
          today,
        );
        if (problem) throw promoError(problem);
        const live = promo as PromoCodeRow;
        const months = redemptionMonths(today, live.duration_months);
        const id = await promoRepository.insertRedemption(client, {
          promoCodeId: live.id,
          billingAccountId: account.id,
          redeemedBy: actor.userId,
          ...months,
        });
        await recordBillingAudit(client, actor, {
          action: 'create',
          entityType: 'promo_redemption',
          entityId: id,
          billingAccountId: account.id,
          from: null,
          to: { code: live.code, ...months },
          reason: 'promo code redeemed',
        });
        return id;
      },
    );
    const redemption = (
      await promoRepository.listRedemptionsForAccount(
        this.serviceDatabase,
        account.id,
      )
    ).find((row) => row.id === redemptionId) as RedemptionRow;
    return toRedemption(redemption);
  };

  // The account's promo still discounting this month or later, if any.
  findCurrentRedemption = async (
    billingAccountId: string,
    today: string,
  ): Promise<PromoRedemption | null> => {
    const rows = await promoRepository.listRedemptionsForAccount(
      this.serviceDatabase,
      billingAccountId,
    );
    const current = rows.find((row) =>
      isRedemptionCurrent({ endsMonth: row.ends_month }, today),
    );
    return current ? toRedemption(current) : null;
  };

  // ── Shared ───────────────────────────────────────────────────────────

  private get = async (promoCodeId: string): Promise<PromoCode> => {
    const row = await promoRepository.findPromoCode(
      this.serviceDatabase,
      promoCodeId,
    );
    if (!row) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return toPromoCode(row);
  };

  private requireOrganisationAccount = async (actor: AuthenticatedUser) => {
    const account = await termsRepository.findOrganisationAccountTerms(
      this.serviceDatabase,
      actor.tenantId,
    );
    if (!account) throw new NotFoundException(NO_ACCOUNT_MESSAGE);
    return account;
  };

  private findProblem = async (
    database: Pick<ServiceDatabaseService, 'query'>,
    billingAccountId: string,
    promo: PromoCodeRow | undefined,
    today: string,
  ): Promise<PromoErrorCode | null> => {
    const [redemptions, newCustomer] = await Promise.all([
      promoRepository.listRedemptionsForAccount(database, billingAccountId),
      promoRepository.isNewCustomer(database, billingAccountId),
    ]);
    return findRedemptionProblem({
      code: promo && {
        active: promo.active,
        validFrom: promo.valid_from,
        validUntil: promo.valid_until,
        maxRedemptions: promo.max_redemptions,
        redemptionsCount: promo.redemptions_count,
        newCustomersOnly: promo.new_customers_only,
      },
      today,
      alreadyRedeemedByAccount: promo
        ? redemptions.some((row) => row.promo_code_id === promo.id)
        : false,
      accountHasActivePromo: redemptions.some((row) =>
        isRedemptionCurrent({ endsMonth: row.ends_month }, today),
      ),
      accountIsNewCustomer: newCustomer,
    });
  };
}

// The promo terms the monthly run applies for one month, from the account's
// redemptions (the one covering that month, if any).
export const toPromoTerms = (
  rows: RedemptionRow[],
  periodStart: string,
): PromoTerms | null => {
  const row = rows.find(
    (item) =>
      item.starts_month <= periodStart &&
      (item.ends_month === null || periodStart <= item.ends_month),
  );
  return row
    ? {
        redemptionId: row.id,
        promoCodeId: row.promo_code_id,
        code: row.code,
        discountType: row.discount_type,
        discountValue: row.discount_value,
        startsMonth: row.starts_month,
        endsMonth: row.ends_month,
      }
    : null;
};
