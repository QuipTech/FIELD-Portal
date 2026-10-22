// Allowances run per calendar month in UTC, like the admin subscriptions
// page's "queries this month" (admin_list_tenant_subscriptions, 0043).
export const toUtcMonth = (now: Date): { start: Date; end: Date } => ({
  start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
});

export interface AllowanceUsage {
  used: number;
  // null = no limit set.
  allowance: number | null;
  remaining: number | null;
}

export const toAllowanceUsage = (
  used: number,
  allowance: number | null,
): AllowanceUsage => ({
  used,
  allowance,
  remaining: allowance === null ? null : Math.max(0, allowance - used),
});
