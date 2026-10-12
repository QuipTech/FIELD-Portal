import { isEntitlementActive } from './entitlementRules';

const row = (
  overrides: Partial<Parameters<typeof isEntitlementActive>[0]>,
) => ({
  feature_code: 'ai_assistant',
  is_enabled: true,
  limit_value: 4000,
  valid_until: null,
  ...overrides,
});

describe('isEntitlementActive', () => {
  it('is active when enabled with no end date', () => {
    expect(isEntitlementActive(row({}))).toBe(true);
  });

  it('is inactive when disabled', () => {
    expect(isEntitlementActive(row({ is_enabled: false }))).toBe(false);
  });

  it('stays active through the last day of the term, then stops', () => {
    const lastDay = new Date(2027, 2, 22);
    expect(
      isEntitlementActive(
        row({ valid_until: lastDay }),
        new Date(2027, 2, 22, 18),
      ),
    ).toBe(true);
    expect(
      isEntitlementActive(
        row({ valid_until: lastDay }),
        new Date(2027, 2, 23, 0, 1),
      ),
    ).toBe(false);
  });
});
