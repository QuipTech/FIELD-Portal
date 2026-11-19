import { Injectable } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { findAccountTerms } from '../accountTerms/accountTerms.repository';
import { CalculatedLine } from '../monthlyRun/monthlyRunTypes';
import { calculateDiscountLines } from './discountRules';
import { listRedemptionsForAccount } from './promoCodes.repository';
import { toPromoTerms } from './promoCodes.service';

type Reader = Pick<ServiceDatabaseService, 'query'>;

// The one place discounts are worked out: the account's free period first,
// then its promo for that month, on machine charges only, never below A$0
// (discountRules.ts). Returns the discount lines to add to the month.
@Injectable()
export class DiscountService {
  discountLinesForMonth = async (
    database: Reader,
    billingAccountId: string,
    periodStart: string,
    lines: CalculatedLine[],
  ): Promise<CalculatedLine[]> => {
    const [terms, redemptions] = await Promise.all([
      findAccountTerms(database, billingAccountId),
      listRedemptionsForAccount(database, billingAccountId),
    ]);
    return calculateDiscountLines({
      periodStart,
      lines,
      freePeriod: terms?.free_until
        ? { freeUntil: terms.free_until, percent: terms.free_percent }
        : null,
      promo: toPromoTerms(redemptions, periodStart),
    });
  };
}
