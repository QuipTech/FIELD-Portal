// Enterprise is a quoted annual contract with a floor from the price book
// (ENTERPRISE minimum_annual_cents). Returns the problem, or null when the
// quote is acceptable (spec T8a).
export const findEnterpriseQuoteProblem = (
  annualQuoteCents: number,
  minimumAnnualCents: number,
): string | null => {
  if (!Number.isSafeInteger(annualQuoteCents) || annualQuoteCents < 0) {
    return 'The annual quote must be whole cents.';
  }
  return annualQuoteCents < minimumAnnualCents
    ? `An Enterprise contract must be at least ${minimumAnnualCents} cents a year.`
    : null;
};

// A self-serve account at or past ENTERPRISE_THRESHOLD_MACHINES raises one
// sales review task; activation is never refused (spec decision, T8).
export const hasReachedEnterpriseThreshold = (
  activeMachines: number,
  thresholdMachines: number,
): boolean => activeMachines >= thresholdMachines;
