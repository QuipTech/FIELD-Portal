import { Injectable, NotFoundException } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { PinnedPriceBook } from '../pricing/pricingTypes';
import { toPinnedPriceBook } from './priceBookMapper';
import { PriceBookRow } from './priceBookRows';
import {
  findPriceBookById,
  findPriceBookInEffect,
  listPriceBands,
} from './priceBooks.repository';

// Loads price books for the pricing functions. A subscription stores the
// id it pinned, so later calculations read that exact version (T27).
@Injectable()
export class PriceBooksService {
  constructor(private readonly serviceDatabase: ServiceDatabaseService) {}

  getPinnedPriceBook = async (priceBookId: string): Promise<PinnedPriceBook> =>
    this.withBands(
      await findPriceBookById(this.serviceDatabase, priceBookId),
      `Price book ${priceBookId} not found`,
    );

  getPriceBookInEffect = async (
    planCode: string,
    onDay: string,
  ): Promise<PinnedPriceBook> =>
    this.withBands(
      await findPriceBookInEffect(this.serviceDatabase, planCode, onDay),
      `No ${planCode} price book is in effect on ${onDay}`,
    );

  private withBands = async (
    book: PriceBookRow | undefined,
    notFoundMessage: string,
  ): Promise<PinnedPriceBook> => {
    if (!book) throw new NotFoundException(notFoundMessage);
    const bands = await listPriceBands(this.serviceDatabase, book.id);
    return toPinnedPriceBook(book, bands);
  };
}
