import {
  ReportFigures,
  StatementLine,
  StatementStatus,
} from './statementRules';

// One billing account's statement for a month, as the month-end report
// shows it. Amounts are AUD cents; discounts are negative.
export interface MonthEndReportRow extends ReportFigures {
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
  // Past the Zoho due date; null unless invoiced and unpaid.
  daysOverdue: number | null;
  lines: StatementLine[];
}

export interface MonthEndReport {
  month: string;
  // Marked ready: its statements are locked.
  locked: boolean;
  lockedAt: string | null;
  rows: MonthEndReportRow[];
  totals: {
    subtotalExGstCents: number;
    gstCents: number;
    totalIncGstCents: number;
  };
}

// A machine on a statement: what it was, and its days active that month.
export interface StatementMachine {
  machineId: string;
  plantId: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string;
  activeDays: number;
  deleted: boolean;
}

// What an organisation sees of its own statements.
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
