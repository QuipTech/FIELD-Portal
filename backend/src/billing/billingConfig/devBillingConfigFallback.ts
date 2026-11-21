import { Logger } from '@nestjs/common';

// TEMPORARY, local development only. The shared quiptech_dev database is
// missing migrations 0131 and 0138, so these billing.config keys don't
// exist there and every billing call failed with "billing.config is
// incomplete". In development, missing keys take the same defaults those
// migrations seed. REQUIRE_USER_SUBSCRIPTION false means nobody has to pay a
// subscription. Staging and production (NODE_ENV staging / production) still
// fail loudly. Remove this file once quiptech_dev is migrated.
const DEV_DEFAULTS: Record<string, unknown> = {
  REQUIRE_USER_SUBSCRIPTION: false,
  ACCOUNT_DEFAULT_TERMS_DAYS: 30,
  BANK_ACCOUNT_NAME: '',
  BANK_BSB: '',
  BANK_ACCOUNT_NUMBER: '',
  PAYMENT_REFERENCE_FORMAT: 'FIELD-{invoiceRef}',
  INVOICE_REMINDER_OFFSET_DAYS: [-7, 0, 7, 14],
  STATEMENT_REMINDERS_EMAIL_CLIENT: false,
};

const logger = new Logger('DevBillingConfigFallback');
let warned = false;

export const withDevBillingDefaults = <
  Row extends { key: string; value: unknown },
>(
  rows: Row[],
): { key: string; value: unknown }[] => {
  if (process.env.NODE_ENV !== 'development') return rows;
  const present = new Set(rows.map((row) => row.key));
  const filled = Object.entries(DEV_DEFAULTS)
    .filter(([key]) => !present.has(key))
    .map(([key, value]) => ({ key, value }));
  if (filled.length > 0 && !warned) {
    warned = true;
    logger.warn(
      `billing.config is missing ${filled.map((row) => row.key).join(', ')}; using development defaults (no subscription required). Apply migrations to this database to remove this.`,
    );
  }
  return [...rows, ...filled];
};
