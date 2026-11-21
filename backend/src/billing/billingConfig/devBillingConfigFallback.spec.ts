import { withDevBillingDefaults } from './devBillingConfigFallback';

describe('development billing config fallback', () => {
  const original = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it('fills missing keys with the migration defaults in development', () => {
    process.env.NODE_ENV = 'development';
    const rows = withDevBillingDefaults([{ key: 'BANK_BSB', value: '123-456' }]);
    const values = new Map(rows.map((row) => [row.key, row.value]));
    expect(values.get('REQUIRE_USER_SUBSCRIPTION')).toBe(false);
    expect(values.get('BANK_BSB')).toBe('123-456');
    expect(rows.filter((row) => row.key === 'BANK_BSB')).toHaveLength(1);
  });

  it.each(['staging', 'production'])('changes nothing in %s', (environment) => {
    process.env.NODE_ENV = environment;
    expect(withDevBillingDefaults([])).toEqual([]);
  });
});
