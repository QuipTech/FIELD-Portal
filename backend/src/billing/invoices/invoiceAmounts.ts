import { BadRequestException } from '@nestjs/common';

// Stripe's largest single amount for AUD: 99,999,999 cents ($999,999.99).
export const MAX_STRIPE_AMOUNT_CENTS = 99_999_999;

export interface StripeInvoiceTotals {
  total: number;
  total_excluding_tax: number | null;
}

export interface InvoiceTotals {
  totalExGstCents: number;
  gstCents: number;
  totalCents: number;
}

// FIELD calculates every amount; Stripe only adds GST on top.
export const calculateLineAmountCents = (
  quantity: number,
  unitCents: number,
): number => {
  const amountCents = quantity * unitCents;
  if (amountCents > MAX_STRIPE_AMOUNT_CENTS) {
    throw new BadRequestException(
      `A line's quantity × unitCents must not exceed ${MAX_STRIPE_AMOUNT_CENTS} cents.`,
    );
  }
  return amountCents;
};

export const sumAmountCents = (amounts: number[]): number =>
  amounts.reduce((sum, amount) => sum + amount, 0);

// GST is whatever Stripe Tax added on top of the ex-tax total (0 when tax
// is off).
export const toInvoiceTotals = (
  stripeInvoice: StripeInvoiceTotals,
): InvoiceTotals => {
  const totalExGstCents =
    stripeInvoice.total_excluding_tax ?? stripeInvoice.total;
  return {
    totalExGstCents,
    gstCents: stripeInvoice.total - totalExGstCents,
    totalCents: stripeInvoice.total,
  };
};
