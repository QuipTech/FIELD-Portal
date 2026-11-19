// The month-end report as files: the report itself (CSV or Excel), and the
// Zoho Books invoice import (one row per charge and one per discount,
// grouped into an invoice by Invoice Number).
import { GST_TAX_NAME, StatementLine } from './statementRules';
import { MonthEndReportRow } from './statementTypes';
import { writeXlsx } from './xlsxWriter';

export type ExportFormat = 'csv' | 'xlsx' | 'zoho';
export const EXPORT_FORMATS: ExportFormat[] = ['csv', 'xlsx', 'zoho'];

type Cell = string | number | null;

export interface ExportTable {
  columns: string[];
  rows: Cell[][];
}

const dollars = (cents: number | null): number | null =>
  cents === null ? null : Math.round(cents) / 100;

export const REPORT_COLUMNS = [
  'Organisation',
  'Legal name',
  'ABN',
  'Accounts email',
  'PO number',
  'Billing month',
  'Reference',
  'Peak active machines',
  'Rate band',
  'Unit price (A$)',
  'Machine charge (A$)',
  'Free period discount (A$)',
  'Promo code',
  'Promo discount (A$)',
  'Other charges (A$)',
  'Subtotal ex GST (A$)',
  'GST (A$)',
  'Total inc GST (A$)',
  'Status',
  'Zoho invoice number',
  'Zoho invoice date',
  'Due date',
  'Paid on',
  'Payment reference',
];

export const buildReportTable = (rows: MonthEndReportRow[]): ExportTable => ({
  columns: REPORT_COLUMNS,
  rows: rows.map((row) => [
    row.organisationName,
    row.legalName,
    row.abn,
    row.accountsEmail,
    row.poNumber,
    row.billingMonth.slice(0, 7),
    row.reference,
    row.peakActiveMachines,
    row.rateBand,
    dollars(row.unitPriceCents),
    dollars(row.machineChargeCents),
    dollars(row.freePeriodDiscountCents),
    row.promoCode,
    dollars(row.promoDiscountCents),
    dollars(row.otherChargesCents),
    dollars(row.subtotalExGstCents),
    dollars(row.gstCents),
    dollars(row.totalIncGstCents),
    row.status,
    row.zohoInvoiceNumber,
    row.zohoInvoiceDate,
    row.dueOn,
    row.paidOn,
    row.paidReference,
  ]),
});

// Zoho Books invoice import columns.
export const ZOHO_COLUMNS = [
  'Customer Name',
  'Invoice Date',
  'Invoice Number',
  'Item Name',
  'Item Description',
  'Quantity',
  'Rate',
  'Tax Name',
  'Reference',
];

const ITEM_NAMES: Record<string, string> = {
  ASSET_PRO: 'FIELD Asset Professional',
  ASSET_PRO_OVER_COMMIT: 'FIELD Asset Professional over commitment',
  ASSET_PRO_FINAL_DAYS: 'FIELD Asset Professional final days',
  ASSET_PRO_ANNUAL: 'FIELD Asset Professional annual term',
  TECH: 'FIELD Technician',
  TECH_ANNUAL: 'FIELD Technician annual term',
  ONBOARD_ASSISTED: 'Assisted onboarding',
  FREE_PERIOD_DISCOUNT: 'Free period discount',
  PROMO_DISCOUNT: 'Promo code discount',
};

export const toZohoItemName = (lineType: string) =>
  ITEM_NAMES[lineType] ?? lineType;

// A line priced per unit keeps its quantity; a discount is one line at a
// negative rate. Statements with nothing to invoice (A$0) are left out.
export const buildZohoTable = (
  rows: MonthEndReportRow[],
  invoiceDate: string,
): ExportTable => ({
  columns: ZOHO_COLUMNS,
  rows: rows
    .filter((row) => row.subtotalExGstCents > 0)
    .flatMap((row) =>
      row.lines.map((line: StatementLine) => [
        row.legalName ?? row.organisationName,
        invoiceDate,
        row.reference,
        toZohoItemName(line.lineType),
        line.description,
        line.quantity,
        dollars(line.unitCents),
        GST_TAX_NAME,
        row.poNumber,
      ]),
    ),
});

const csvCell = (value: Cell): string => {
  if (value === null) return '';
  const text = typeof value === 'number' ? value.toFixed(2) : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Whole numbers (quantities, peaks) stay whole; money keeps two decimals.
const INTEGER_COLUMNS = new Set(['Peak active machines', 'Quantity']);

export const toCsv = (table: ExportTable): string => {
  const lines = [table.columns.map(csvCell).join(',')];
  for (const row of table.rows) {
    lines.push(
      row
        .map((value, index) =>
          typeof value === 'number' && INTEGER_COLUMNS.has(table.columns[index])
            ? String(value)
            : csvCell(value),
        )
        .join(','),
    );
  }
  return `${lines.join('\r\n')}\r\n`;
};

// Money columns show two decimals in Excel.
const isMoneyColumn = (column: string) =>
  column.includes('(A$)') || column === 'Rate';

export const toXlsx = (table: ExportTable, sheetName: string): Buffer =>
  writeXlsx({
    sheetName,
    columns: table.columns,
    rows: table.rows,
    isMoneyColumn,
  });
