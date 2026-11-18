import {
  BILLING_CONFIG_KEYS,
  BillingConfig,
  BillingConfigKey,
  BillingConfigValueKind,
} from './billingConfigKeys';

const MAX_TEXT_LENGTH = 200;
const MAX_DAY_OFFSETS = 10;
const MAX_DAY_OFFSET = 365;

const isKnownTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

// Whether a stored (or proposed) value fits its key's kind. The config
// editor validates with this before saving, and loading refuses bad rows
// rather than billing on them.
export const isValidConfigValue = (
  kind: BillingConfigValueKind,
  value: unknown,
): boolean => {
  switch (kind) {
    case 'positiveInteger':
      return Number.isSafeInteger(value) && (value as number) > 0;
    case 'nonNegativeInteger':
      return Number.isSafeInteger(value) && (value as number) >= 0;
    case 'ratio':
      return typeof value === 'number' && value > 0;
    case 'optionalPositiveNumber':
      return value === null || (typeof value === 'number' && value > 0);
    case 'timeZone':
      return typeof value === 'string' && isKnownTimeZone(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'text':
      return typeof value === 'string' && value.length <= MAX_TEXT_LENGTH;
    case 'dayOffsets':
      return (
        Array.isArray(value) &&
        value.length <= MAX_DAY_OFFSETS &&
        value.every(
          (item) =>
            Number.isSafeInteger(item) &&
            Math.abs(item as number) <= MAX_DAY_OFFSET,
        )
      );
  }
};

export const isBillingConfigKey = (key: string): key is BillingConfigKey =>
  Object.prototype.hasOwnProperty.call(BILLING_CONFIG_KEYS, key);

// Every key must be present and valid: a missing or malformed value is a
// deployment error, never a reason to fall back to a guessed default.
export const toBillingConfig = (
  rows: { key: string; value: unknown }[],
): BillingConfig => {
  const valuesByKey = new Map(rows.map((row) => [row.key, row.value]));
  const problems: string[] = [];
  const config: Record<string, unknown> = {};

  (Object.keys(BILLING_CONFIG_KEYS) as BillingConfigKey[]).forEach((key) => {
    if (!valuesByKey.has(key)) {
      problems.push(`${key} is missing`);
      return;
    }
    const value = valuesByKey.get(key);
    if (!isValidConfigValue(BILLING_CONFIG_KEYS[key], value)) {
      problems.push(`${key} has an invalid value`);
      return;
    }
    config[key] = value;
  });

  if (problems.length > 0) {
    throw new Error(`billing.config is incomplete: ${problems.join('; ')}`);
  }
  return config as BillingConfig;
};
