export interface EntitlementRow {
  feature_code: string;
  is_enabled: boolean;
  limit_value: number | null;
  valid_until: Date | null;
}

export interface Entitlement {
  featureCode: string;
  // Enabled and not past valid_until.
  isActive: boolean;
  limit: number | null;
  validUntil: string | null;
}

// valid_until is inclusive: the last day of the term still counts.
export const isEntitlementActive = (
  row: EntitlementRow,
  today = new Date(),
): boolean => {
  if (!row.is_enabled) return false;
  if (!row.valid_until) return true;
  const lastDay = new Date(row.valid_until);
  lastDay.setHours(23, 59, 59, 999);
  return lastDay.getTime() >= today.getTime();
};

export const toEntitlement = (
  row: EntitlementRow,
  today = new Date(),
): Entitlement => ({
  featureCode: row.feature_code,
  isActive: isEntitlementActive(row, today),
  limit: row.limit_value,
  validUntil: row.valid_until
    ? [
        row.valid_until.getFullYear(),
        String(row.valid_until.getMonth() + 1).padStart(2, '0'),
        String(row.valid_until.getDate()).padStart(2, '0'),
      ].join('-')
    : null,
});
