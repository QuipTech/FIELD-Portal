// How a FIELD invoice is presented on Stripe (pure). An approved 30-day
// account gets send_invoice with its own terms and the bank details in the
// footer; everyone else keeps the card flow. A PO number, when there is
// one, is printed on any invoice as a Stripe custom field.

// Stripe limits: a custom field value is at most 140 characters; the
// footer at most 5000.
const MAX_CUSTOM_FIELD_VALUE = 140;
const MAX_FOOTER_LENGTH = 5000;
export const PO_FIELD_NAME = 'PO number';
export const PO_NOT_PROVIDED = 'Not provided';

export interface BankDetails {
  BANK_ACCOUNT_NAME: string;
  BANK_BSB: string;
  BANK_ACCOUNT_NUMBER: string;
  PAYMENT_REFERENCE_FORMAT: string;
}

export interface InvoicePresentation {
  // Account terms: send the invoice with these days to pay, never charge a
  // card. null = the card flow decides (saved card or PAYMENT_TERMS_DAYS).
  accountTermsDays: number | null;
  footer: string | null;
  customFields: { name: string; value: string }[];
  // po_required but no PO anywhere: the invoice still goes out and a
  // platform administrator is told.
  poMissing: boolean;
}

// {invoiceRef} = first 8 characters of the FIELD invoice id, upper case.
export const formatPaymentReference = (
  format: string,
  values: { invoiceId: string; accountName: string },
): string =>
  format
    .replace(
      /\{invoiceRef\}/g,
      values.invoiceId.replace(/-/g, '').slice(0, 8).toUpperCase(),
    )
    .replace(/\{accountName\}/g, values.accountName)
    .trim();

// The footer's bank transfer block; null when no bank details are set yet.
export const buildBankFooter = (
  bank: BankDetails,
  values: { invoiceId: string; accountName: string; termsDays: number },
): string | null => {
  const lines = [
    bank.BANK_ACCOUNT_NAME && `Account name: ${bank.BANK_ACCOUNT_NAME}`,
    bank.BANK_BSB && `BSB: ${bank.BANK_BSB}`,
    bank.BANK_ACCOUNT_NUMBER && `Account number: ${bank.BANK_ACCOUNT_NUMBER}`,
  ].filter(Boolean);
  if (!lines.length) return null;
  const reference = formatPaymentReference(
    bank.PAYMENT_REFERENCE_FORMAT,
    values,
  );
  return [
    `Please pay by bank transfer within ${values.termsDays} days.`,
    ...lines,
    reference && `Payment reference: ${reference}`,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_FOOTER_LENGTH);
};

export const buildInvoicePresentation = (input: {
  invoiceId: string;
  accountName: string;
  usesAccountTerms: boolean;
  termsDays: number;
  poRequired: boolean;
  invoicePoNumber: string | null;
  defaultPoNumber: string | null;
  bank: BankDetails;
}): InvoicePresentation => {
  const po = (input.invoicePoNumber ?? input.defaultPoNumber ?? '').trim();
  const poMissing = input.poRequired && !po;
  const customFields =
    po || input.poRequired
      ? [
          {
            name: PO_FIELD_NAME,
            value: (po || PO_NOT_PROVIDED).slice(0, MAX_CUSTOM_FIELD_VALUE),
          },
        ]
      : [];
  if (!input.usesAccountTerms)
    return { accountTermsDays: null, footer: null, customFields, poMissing };
  return {
    accountTermsDays: input.termsDays,
    footer: buildBankFooter(input.bank, {
      invoiceId: input.invoiceId,
      accountName: input.accountName,
      termsDays: input.termsDays,
    }),
    customFields,
    poMissing,
  };
};
