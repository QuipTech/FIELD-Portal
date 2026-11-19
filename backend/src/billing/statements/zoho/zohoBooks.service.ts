import { Injectable, NotImplementedException } from '@nestjs/common';
import { MonthEndReportRow } from '../statementTypes';

// What a direct Zoho Books API integration will need to do. Today QuipTech
// imports the month-end Zoho export by hand and types the invoice number
// back in; this stays unused until the integration is built.
export interface ZohoBooksClient {
  // Creates the Zoho invoice for one statement; its number and date.
  createInvoice(
    statement: MonthEndReportRow,
    invoiceDate: string,
  ): Promise<{ invoiceNumber: string; invoiceDate: string }>;
  // Whether Zoho has the invoice as paid, and when.
  getInvoiceStatus(
    invoiceNumber: string,
  ): Promise<{ paid: boolean; paidOn: string | null }>;
}

export const ZOHO_NOT_BUILT_MESSAGE =
  'The Zoho Books integration is not built yet. Use the Zoho export instead.';

// Stub: not called anywhere yet.
@Injectable()
export class ZohoBooksService implements ZohoBooksClient {
  readonly isAvailable = false;

  createInvoice(): Promise<{ invoiceNumber: string; invoiceDate: string }> {
    return Promise.reject(new NotImplementedException(ZOHO_NOT_BUILT_MESSAGE));
  }

  getInvoiceStatus(): Promise<{ paid: boolean; paidOn: string | null }> {
    return Promise.reject(new NotImplementedException(ZOHO_NOT_BUILT_MESSAGE));
  }
}
