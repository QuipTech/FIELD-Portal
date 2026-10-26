import {
  calculateAllowance,
  closeConsecutiveOver,
  nextThresholdState,
  usageRatio,
} from './allowanceRules';

const config = {
  AI_ALLOWANCE_PER_ACTIVE_MACHINE: 100,
  AI_ALLOWANCE_PER_TECH_USER: 300,
  STORAGE_ALLOWANCE_PER_ACTIVE_MACHINE: 1000,
  INGEST_ALLOWANCE: 50,
};
const thresholds = { notifyAt: 0.8, flagAt: 1 };

describe('fair-use allowance (spec section 6)', () => {
  it('pools AI turns over average machines and TECH users', () => {
    expect(
      calculateAllowance('ai_turns', {
        averageActiveMachines: 12.5,
        techUsers: 2,
        config,
      }),
    ).toBe(1850);
    expect(
      calculateAllowance('storage_bytes', {
        averageActiveMachines: 3,
        techUsers: 2,
        config,
      }),
    ).toBe(3000);
    expect(
      calculateAllowance('ingest_pages', {
        averageActiveMachines: 3,
        techUsers: 0,
        config,
      }),
    ).toBe(150);
  });

  it('notifies at 80% and flags at 100%, each once a month', () => {
    expect(nextThresholdState('ok', 0.5, thresholds)).toBe('ok');
    expect(nextThresholdState('ok', 0.8, thresholds)).toBe('notified');
    expect(nextThresholdState('notified', 1.2, thresholds)).toBe('flagged');
    // Use falling back (e.g. storage freed) never un-flags the month.
    expect(nextThresholdState('flagged', 0.4, thresholds)).toBe('flagged');
  });

  it('treats any use against a zero allowance as over', () => {
    expect(usageRatio(5, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(usageRatio(0, 0)).toBe(0);
  });

  it('counts months in a row ending over 100% (T26 raises a review at 2)', () => {
    expect(closeConsecutiveOver(0, 120, 100)).toBe(1);
    expect(closeConsecutiveOver(1, 120, 100)).toBe(2);
    expect(closeConsecutiveOver(1, 90, 100)).toBe(0);
  });
});
