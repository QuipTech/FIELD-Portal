export interface PersonalBillingStatus {
  exempt: boolean;
  // An active TECH seat paid by the user's organisation covers this month.
  coveredByOrganisation: boolean;
  paymentRequired: boolean;
  monthlyCents: number;
  currency: "AUD";
  timezone: string;
  periodStart: string;
  periodEnd: string;
  invoiceId: string | null;
  invoiceStatus: string | null;
  gstCents: number | null;
  totalCents: number | null;
  hostedInvoiceUrl: string | null;
}

export interface PersonalBillingAddress {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  returnOrigin?: string;
}

export interface PersonalInvoice {
  invoiceId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalExGstCents: number;
  gstCents: number | null;
  totalCents: number | null;
  hostedInvoiceUrl: string | null;
}
