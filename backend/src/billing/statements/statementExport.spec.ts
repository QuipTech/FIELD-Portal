import { inflateRawSync } from 'zlib';
import {
  buildReportTable,
  buildZohoTable,
  REPORT_COLUMNS,
  toCsv,
  toXlsx,
  ZOHO_COLUMNS,
} from './statementExport';
import { MonthEndReportRow } from './statementTypes';

const row = (
  overrides: Partial<MonthEndReportRow> = {},
): MonthEndReportRow => ({
  statementId: 'st-1',
  reference: 'FLD-2026-10-0001',
  billingAccountId: 'acct-1',
  organisationName: 'Acme',
  legalName: 'Acme Mining Pty Ltd',
  abn: '12345678901',
  accountsEmail: 'accounts@acme.test',
  poNumber: 'PO-77',
  paymentType: 'account',
  billingMonth: '2026-10-01',
  promoCode: 'SPRING',
  peakActiveMachines: 20,
  rateBand: '11–50',
  unitPriceCents: 3500,
  machineChargeCents: 70000,
  freePeriodDiscountCents: 0,
  promoDiscountCents: -14000,
  otherChargesCents: 0,
  subtotalExGstCents: 56000,
  gstCents: 5600,
  totalIncGstCents: 61600,
  status: 'ready',
  termsDays: 30,
  zohoInvoiceNumber: null,
  zohoInvoiceDate: null,
  dueOn: null,
  paidOn: null,
  paidReference: null,
  daysOverdue: null,
  lines: [
    {
      lineType: 'ASSET_PRO',
      description: 'FIELD Asset Professional, October: peak 20, "fleet"',
      quantity: 20,
      unitCents: 3500,
      amountCents: 70000,
      calcSnapshot: {},
    },
    {
      lineType: 'PROMO_DISCOUNT',
      description: 'Promo code SPRING (20% off)',
      quantity: 1,
      unitCents: -14000,
      amountCents: -14000,
      calcSnapshot: { promoCode: 'SPRING' },
    },
  ],
  ...overrides,
});

describe('month-end report export', () => {
  it('has one row per billing account with every report column', () => {
    const table = buildReportTable([
      row(),
      row({ statementId: 'st-2', organisationName: 'Beta' }),
    ]);
    expect(table.columns).toEqual(REPORT_COLUMNS);
    expect(table.columns).toEqual(
      expect.arrayContaining([
        'Organisation',
        'Legal name',
        'ABN',
        'Accounts email',
        'PO number',
        'Billing month',
        'Peak active machines',
        'Rate band',
        'Unit price (A$)',
        'Machine charge (A$)',
        'Free period discount (A$)',
        'Promo code',
        'Promo discount (A$)',
        'Subtotal ex GST (A$)',
        'GST (A$)',
        'Total inc GST (A$)',
        'Status',
      ]),
    );
    expect(table.rows).toHaveLength(2);
    const csv = toCsv(table).split('\r\n');
    expect(csv[1]).toBe(
      'Acme,Acme Mining Pty Ltd,12345678901,accounts@acme.test,PO-77,2026-10,FLD-2026-10-0001,20,11–50,35.00,700.00,0.00,SPRING,-140.00,0.00,560.00,56.00,616.00,ready,,,,,',
    );
  });

  it('writes an .xlsx workbook with the same columns', () => {
    const file = toXlsx(buildReportTable([row()]), 'Month end 2026-10');
    expect(file.subarray(0, 2).toString()).toBe('PK');
    // The sheet part: find its local header and inflate it.
    const name = 'xl/worksheets/sheet1.xml';
    const at = file.indexOf(name);
    const size = file.readUInt32LE(at - 30 + 18);
    const sheet = inflateRawSync(
      file.subarray(at + name.length, at + name.length + size),
    ).toString();
    expect(sheet).toContain('Legal name');
    expect(sheet).toContain('Acme Mining Pty Ltd');
    expect(sheet).toContain('<v>616</v>');
  });
});

describe('Zoho Books import', () => {
  it('has the Zoho columns, one line per charge and one per discount', () => {
    const table = buildZohoTable([row()], '2026-11-01');
    expect(table.columns).toEqual(ZOHO_COLUMNS);
    expect(table.columns).toEqual([
      'Customer Name',
      'Invoice Date',
      'Invoice Number',
      'Item Name',
      'Item Description',
      'Quantity',
      'Rate',
      'Tax Name',
      'Reference',
    ]);
    expect(table.rows).toEqual([
      [
        'Acme Mining Pty Ltd',
        '2026-11-01',
        'FLD-2026-10-0001',
        'FIELD Asset Professional',
        'FIELD Asset Professional, October: peak 20, "fleet"',
        20,
        35,
        'GST 10%',
        'PO-77',
      ],
      [
        'Acme Mining Pty Ltd',
        '2026-11-01',
        'FLD-2026-10-0001',
        'Promo code discount',
        'Promo code SPRING (20% off)',
        1,
        -140,
        'GST 10%',
        'PO-77',
      ],
    ]);
    const csv = toCsv(table).split('\r\n');
    expect(csv[0]).toBe(ZOHO_COLUMNS.join(','));
    expect(csv[1]).toBe(
      'Acme Mining Pty Ltd,2026-11-01,FLD-2026-10-0001,FIELD Asset Professional,"FIELD Asset Professional, October: peak 20, ""fleet""",20,35.00,GST 10%,PO-77',
    );
  });

  it('falls back to the organisation name, and leaves out A$0 statements', () => {
    const table = buildZohoTable(
      [
        row({ legalName: null }),
        row({ statementId: 'st-2', subtotalExGstCents: 0 }),
      ],
      '2026-11-01',
    );
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0][0]).toBe('Acme');
  });
});
