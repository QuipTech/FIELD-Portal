import { Injectable, NotFoundException } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { toIsoDay } from '../../common/utils/toIsoDay';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { PLAN_CODES } from '../subscriptions/planCodes';

// What a customer can buy, in display order. HARDWARE and INTERNAL are
// manual or internal lines, never offered.
const BASE_PLANS = [PLAN_CODES.assetPro, PLAN_CODES.enterprise];
const ADD_ONS = [
  PLAN_CODES.tech,
  PLAN_CODES.remoteSession,
  PLAN_CODES.onboardAssisted,
];
// Quoted per contract: no list price.
const QUOTED_PLANS: string[] = [PLAN_CODES.enterprise];

interface PlanRow {
  code: string;
  name: string;
  unit: string | null;
  billing_basis: string | null;
}

export interface PlanOption {
  code: string;
  name: string;
  // e.g. "active machine / month".
  unit: string | null;
  // e.g. "monthly in arrears or annual prepaid".
  billingBasis: string | null;
  // Integer cents ex GST for flat-priced lines; null when banded or quoted.
  unitCents: number | null;
  // ASSET_PRO: the price per unit by quantity band (upperQty null = and up).
  bands: { lowerQty: number; upperQty: number | null; unitCents: number }[];
  isQuoted: boolean;
}

// GET /organisation/subscription/options
export interface PlanOptions {
  // The price book day the prices are from.
  pricesOn: string;
  plans: PlanOption[];
  addOns: PlanOption[];
}

@Injectable()
export class PlanOptionsService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly priceBooks: PriceBooksService,
  ) {}

  listOptions = async (): Promise<PlanOptions> => {
    const pricesOn = toIsoDay(new Date());
    const result = await this.serviceDatabase.query<PlanRow>(
      `SELECT code, name, unit, billing_basis FROM platform.plans
       WHERE code = ANY($1)`,
      [[...BASE_PLANS, ...ADD_ONS]],
    );
    const options = new Map(
      await Promise.all(
        result.rows.map(
          async (row) =>
            [row.code, await this.toOption(row, pricesOn)] as const,
        ),
      ),
    );
    const pick = (codes: string[]) =>
      codes.flatMap((code) => {
        const option = options.get(code);
        return option ? [option] : [];
      });
    return { pricesOn, plans: pick(BASE_PLANS), addOns: pick(ADD_ONS) };
  };

  private toOption = async (
    row: PlanRow,
    pricesOn: string,
  ): Promise<PlanOption> => {
    const isQuoted = QUOTED_PLANS.includes(row.code);
    const book = isQuoted ? null : await this.findPriceBook(row.code, pricesOn);
    return {
      code: row.code,
      name: row.name,
      unit: row.unit,
      billingBasis: row.billing_basis,
      unitCents: book?.unitCents ?? null,
      bands: (book?.bands ?? []).map(({ lowerQty, upperQty, unitCents }) => ({
        lowerQty,
        upperQty,
        unitCents,
      })),
      isQuoted,
    };
  };

  // A plan with no price book in effect yet is listed without a price.
  private findPriceBook = async (planCode: string, onDay: string) => {
    try {
      return await this.priceBooks.getPriceBookInEffect(planCode, onDay);
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  };
}
