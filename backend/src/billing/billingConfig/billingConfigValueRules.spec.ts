import { BILLING_CONFIG_KEYS } from './billingConfigKeys';
import { isValidConfigValue, toBillingConfig } from './billingConfigValueRules';

// The values migration 0095 seeds.
const SEEDED_VALUES: Record<string, unknown> = {
  ENTERPRISE_THRESHOLD_MACHINES: 500,
  ANNUAL_MONTHS_CHARGED: 10,
  REMOTE_BLOCK_MINUTES: 15,
  REMOTE_MIN_SECONDS: 120,
  AI_ALLOWANCE_PER_ACTIVE_MACHINE: 100,
  AI_ALLOWANCE_PER_TECH_USER: 300,
  AI_NOTIFY_THRESHOLD: 0.8,
  AI_FLAG_THRESHOLD: 1.0,
  AI_ABUSE_CEILING_MULTIPLIER: null,
  STORAGE_ALLOWANCE_PER_ACTIVE_MACHINE: 5368709120,
  INGEST_ALLOWANCE: 500,
  PARTNER_DEFAULT_MARGIN_BPS: 2500,
  PAYMENT_TERMS_DAYS: 14,
  INVOICE_REVIEW_HOURS: 24,
  DEFAULT_BILLING_TIMEZONE: 'Australia/Brisbane',
  CANCEL_EXPORT_DAYS: 30,
  CANCEL_DELETE_DAYS: 90,
};

const seededRows = () =>
  Object.entries(SEEDED_VALUES).map(([key, value]) => ({ key, value }));

describe('toBillingConfig', () => {
  it('loads the seeded values for every key', () => {
    expect(Object.keys(SEEDED_VALUES).sort()).toEqual(
      Object.keys(BILLING_CONFIG_KEYS).sort(),
    );
    expect(toBillingConfig(seededRows())).toEqual(SEEDED_VALUES);
  });

  it('refuses to load when a key is missing, rather than guessing', () => {
    const rows = seededRows().filter(
      (row) => row.key !== 'INVOICE_REVIEW_HOURS',
    );
    expect(() => toBillingConfig(rows)).toThrow(
      /INVOICE_REVIEW_HOURS is missing/,
    );
  });

  it('refuses to load a malformed value', () => {
    const rows = seededRows().map((row) =>
      row.key === 'ANNUAL_MONTHS_CHARGED' ? { ...row, value: '10' } : row,
    );
    expect(() => toBillingConfig(rows)).toThrow(
      /ANNUAL_MONTHS_CHARGED has an invalid value/,
    );
  });

  it('ignores keys it does not know', () => {
    const rows = [...seededRows(), { key: 'RETIRED_KEY', value: 1 }];
    expect(toBillingConfig(rows)).toEqual(SEEDED_VALUES);
  });
});

describe('isValidConfigValue', () => {
  it('accepts null only for the optional abuse ceiling', () => {
    expect(isValidConfigValue('optionalPositiveNumber', null)).toBe(true);
    expect(isValidConfigValue('positiveInteger', null)).toBe(false);
  });

  it('checks time zones against the runtime', () => {
    expect(isValidConfigValue('timeZone', 'Australia/Perth')).toBe(true);
    expect(isValidConfigValue('timeZone', 'Australia/Nowhere')).toBe(false);
  });

  it('refuses zero where a positive integer is required', () => {
    expect(isValidConfigValue('positiveInteger', 0)).toBe(false);
    expect(isValidConfigValue('nonNegativeInteger', 0)).toBe(true);
  });
});
