// One key per Stripe write, derived from our own ids: a retried request
// (ours or the SDK's) returns the original object instead of creating a
// second one. Stripe keeps keys for 24 hours.

export const customerCreateKey = (billingAccountId: string) =>
  `billing-account:${billingAccountId}:customer`;

// rowVersion makes each saved change its own update.
export const customerUpdateKey = (
  billingAccountId: string,
  rowVersion: number,
) => `billing-account:${billingAccountId}:update:${rowVersion}`;

export const invoiceCreateKey = (invoiceId: string) =>
  `invoice:${invoiceId}:create`;

// The brief: an invoice item's key is our invoice line id.
export const invoiceItemCreateKey = (invoiceLineId: string) => invoiceLineId;

export const invoiceFinalizeKey = (invoiceId: string) =>
  `invoice:${invoiceId}:finalize`;
