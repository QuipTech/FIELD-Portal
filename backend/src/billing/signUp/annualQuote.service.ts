import { Injectable } from '@nestjs/common';
import { toBillingDay } from '../billingCalendar/billingDay';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { calculateAnnualUpFrontCents } from '../pricing/annualPricing';
import { calculateFleetPriceCents } from '../pricing/fleetPrice';
import { PLAN_CODES } from '../subscriptions/planCodes';

export interface AnnualQuote {
  committedQty: number;
  monthlyPriceCents: number;
  monthsCharged: number;
  upFrontCents: number;
  priceBookId: string;
  priceBookVersion: number;
}

// The up-front amount shown before a customer confirms an annual term:
// price(Q) × ANNUAL_MONTHS_CHARGED, from the price book that would be
// pinned today. Ex GST, integer cents.
@Injectable()
export class AnnualQuoteService {
  constructor(
    private readonly billingConfigService: BillingConfigService,
    private readonly priceBooksService: PriceBooksService,
  ) {}

  quoteAssetPro = async (
    committedQty: number,
    timezone: string,
    now = new Date(),
  ): Promise<AnnualQuote> => {
    const [config, priceBook] = await Promise.all([
      this.billingConfigService.loadConfig(),
      this.priceBooksService.getPriceBookInEffect(
        PLAN_CODES.assetPro,
        toBillingDay(now, timezone),
      ),
    ]);
    return {
      committedQty,
      monthlyPriceCents: calculateFleetPriceCents(
        priceBook.bands,
        committedQty,
      ),
      monthsCharged: config.ANNUAL_MONTHS_CHARGED,
      upFrontCents: calculateAnnualUpFrontCents(
        priceBook.bands,
        committedQty,
        config.ANNUAL_MONTHS_CHARGED,
      ),
      priceBookId: priceBook.id,
      priceBookVersion: priceBook.version,
    };
  };
}
