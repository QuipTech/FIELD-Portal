// 30-day account statements: QuipTech invoices account clients in Zoho
// Books, not Stripe. Amounts are AUD cents; discounts are negative.
export type StatementStatus = "draft" | "ready" | "invoiced_external" | "paid" | "void";

export const STATEMENT_STATUS_LABELS: Record<StatementStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  invoiced_external: "Invoiced in Zoho",
  paid: "Paid",
  void: "Void",
};

export interface StatementLine {
  lineType: string;
  description: string;
  quantity: number;
  unitCents: number;
  amountCents: number;
}

// GET /admin/billing/statements/report: one row per billing account.
export interface MonthEndReportRow {
  statementId: string;
  reference: string;
  billingAccountId: string;
  organisationName: string;
  legalName: string | null;
  abn: string | null;
  accountsEmail: string | null;
  poNumber: string | null;
  paymentType: string;
  billingMonth: string;
  promoCode: string | null;
  peakActiveMachines: number | null;
  rateBand: string | null;
  unitPriceCents: number | null;
  machineChargeCents: number;
  freePeriodDiscountCents: number;
  promoDiscountCents: number;
  otherChargesCents: number;
  subtotalExGstCents: number;
  gstCents: number;
  totalIncGstCents: number;
  status: StatementStatus;
  termsDays: number;
  zohoInvoiceNumber: string | null;
  zohoInvoiceDate: string | null;
  dueOn: string | null;
  paidOn: string | null;
  paidReference: string | null;
  daysOverdue: number | null;
  lines: StatementLine[];
}

export interface MonthEndReport {
  month: string;
  locked: boolean;
  lockedAt: string | null;
  rows: MonthEndReportRow[];
  totals: { subtotalExGstCents: number; gstCents: number; totalIncGstCents: number };
}

export interface StatementMachine {
  machineId: string;
  plantId: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string;
  activeDays: number;
  deleted: boolean;
}

export interface OverdueStatement {
  statementId: string;
  reference: string;
  billingAccountId: string;
  accountName: string;
  paymentType: string;
  billingMonth: string;
  zohoInvoiceNumber: string | null;
  zohoInvoiceDate: string | null;
  dueOn: string;
  daysOverdue: number;
  outstandingCents: number;
  lastReminderOffset: number | null;
  suspended: boolean;
}

// GET /organisation/billing/statements: what the organisation sees.
export interface OrganisationStatement {
  id: string;
  reference: string;
  billingMonth: string;
  status: StatementStatus;
  subtotalExGstCents: number;
  gstCents: number;
  totalIncGstCents: number;
  zohoInvoiceNumber: string | null;
  zohoInvoiceDate: string | null;
  dueOn: string | null;
  paidOn: string | null;
  overdue: boolean;
  lines: { description: string; amountCents: number }[];
}

export type StatementExportFormat = "csv" | "xlsx" | "zoho";
export type ReportPaymentType = "account" | "card" | "all";

export interface MonthEndFilters {
  // YYYY-MM
  month: string;
  paymentType: ReportPaymentType;
  status: StatementStatus | "all";
}
