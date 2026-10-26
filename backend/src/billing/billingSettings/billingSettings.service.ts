import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { toIsoDay } from '../../common/utils/toIsoDay';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { recordBillingAudit } from '../billingAudit/billingAudit';
import { toBillingDay } from '../billingCalendar/billingDay';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { updateBillingConfigValue } from '../billingConfig/billingConfig.repository';
import { BILLING_CONFIG_KEYS } from '../billingConfig/billingConfigKeys';
import {
  isBillingConfigKey,
  isValidConfigValue,
} from '../billingConfig/billingConfigValueRules';
import { toPinnedPriceBook } from '../priceBooks/priceBookMapper';
import { findPriceBandProblems } from '../pricing/priceBandRules';
import { PLAN_CODES } from '../subscriptions/planCodes';
import * as settingsRepository from './billingSettings.repository';

const UNKNOWN_KEY_MESSAGE = 'Unknown billing setting.';
const TASK_NOT_FOUND_MESSAGE = 'Review task not found.';
// Plans priced by fleet band rather than one flat price.
const BANDED_PLANS: string[] = [PLAN_CODES.assetPro];

export interface NewPriceBookInput {
  planCode: string;
  effectiveFrom: string;
  unitCents: number | null;
  minimumAnnualCents: number | null;
  bands: { lowerQty: number; upperQty: number | null; unitCents: number }[];
}

// The platform admin's billing settings (spec section 11: editable without
// a deploy): price book versions, billing.config values and review tasks.
// A new price book version never re-prices a live subscription; it is
// pinned at the next sign-up or renewal on or after its effective date
// (T27). Every change is audited.
@Injectable()
export class BillingSettingsService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingConfig: BillingConfigService,
  ) {}

  listPriceBooks = async () => {
    const { books, bands } = await settingsRepository.listPriceBooks(
      this.serviceDatabase,
    );
    const today = toBillingDay(new Date(), 'Australia/Brisbane');
    const inEffect = new Map<string, string>();
    for (const book of books) {
      if (
        toIsoDay(book.effective_from) <= today &&
        !inEffect.has(book.plan_code)
      )
        inEffect.set(book.plan_code, book.id);
    }
    return books.map((book) => ({
      ...toPinnedPriceBook(book, bands),
      planName: book.plan_name,
      subscriptionCount: Number(book.subscription_count),
      isInEffect: inEffect.get(book.plan_code) === book.id,
    }));
  };

  createPriceBook = async (
    actor: AuthenticatedUser,
    input: NewPriceBookInput,
  ) => {
    const today = toBillingDay(new Date(), 'Australia/Brisbane');
    if (input.effectiveFrom < today)
      throw new BadRequestException(
        'A new price can only take effect today or later.',
      );
    const isBanded = BANDED_PLANS.includes(input.planCode);
    const bands = input.bands.map((band, index) => ({
      ...band,
      bandNo: index + 1,
    }));
    if (isBanded) {
      const problems = findPriceBandProblems(bands);
      if (problems.length) throw new BadRequestException(problems.join(' '));
    } else if (
      input.unitCents === null &&
      input.planCode !== PLAN_CODES.enterprise
    ) {
      throw new BadRequestException('Enter the price.');
    }
    if (
      input.planCode === PLAN_CODES.enterprise &&
      input.minimumAnnualCents === null
    )
      throw new BadRequestException('Enter the Enterprise annual minimum.');
    const created = await this.serviceDatabase.transaction(async (client) => {
      const book = await settingsRepository.insertPriceBook(client, {
        planCode: input.planCode,
        effectiveFrom: input.effectiveFrom,
        unitCents: isBanded ? null : input.unitCents,
        minimumAnnualCents: input.minimumAnnualCents,
        createdBy: actor.userId,
        bands: isBanded ? bands : [],
      });
      await recordBillingAudit(client, actor, {
        action: 'create',
        entityType: 'billing_price_book',
        entityId: book.id,
        billingAccountId: null,
        from: null,
        to: { ...input, version: book.version },
        reason: 'new price book version',
      });
      return book;
    });
    return created;
  };

  listConfig = async () => {
    const entries = await this.billingConfig.listEntries();
    return entries.map((entry) => ({
      ...entry,
      kind: BILLING_CONFIG_KEYS[entry.key],
    }));
  };

  updateConfig = async (
    actor: AuthenticatedUser,
    key: string,
    value: unknown,
  ) => {
    if (!isBillingConfigKey(key))
      throw new NotFoundException(UNKNOWN_KEY_MESSAGE);
    if (!isValidConfigValue(BILLING_CONFIG_KEYS[key], value))
      throw new BadRequestException(`That isn't a valid value for ${key}.`);
    await this.serviceDatabase.transaction(async (client) => {
      const saved = await updateBillingConfigValue(client, key, value);
      if (!saved) throw new NotFoundException(UNKNOWN_KEY_MESSAGE);
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_config',
        entityId: null,
        billingAccountId: null,
        from: { key, value: saved.previous },
        to: { key, value },
        reason: 'billing setting changed',
      });
    });
    return { key, value };
  };

  listReviewTasks = async (status: 'open' | 'closed' | null) =>
    (
      await settingsRepository.listReviewTasks(this.serviceDatabase, status)
    ).map((row) => ({
      id: row.id,
      billingAccountId: row.billing_account_id,
      accountName: row.account_name,
      type: row.type,
      reason: row.reason,
      status: row.status,
      notes: row.notes,
      details: row.details,
      resolvedAt: row.resolved_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    }));

  updateReviewTask = async (
    actor: AuthenticatedUser,
    taskId: string,
    input: { status: string; notes: string | null },
  ) => {
    await this.serviceDatabase.transaction(async (client) => {
      const saved = await settingsRepository.updateReviewTask(client, {
        id: taskId,
        status: input.status,
        notes: input.notes,
        userId: actor.userId,
      });
      if (!saved) throw new NotFoundException(TASK_NOT_FOUND_MESSAGE);
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_review_task',
        entityId: taskId,
        billingAccountId: saved.billing_account_id,
        from: { status: saved.previous_status },
        to: { status: input.status },
        reason: input.notes ?? 'review task updated',
      });
    });
    return { id: taskId, status: input.status };
  };
}
