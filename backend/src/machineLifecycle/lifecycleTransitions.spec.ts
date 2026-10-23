import {
  canRequestTransfer,
  hasFullMachineAccess,
  listAvailableActions,
  planTransition,
  toLifecycleState,
} from './lifecycleTransitions';

describe('machine lifecycle transitions', () => {
  it('activates a registered machine, counted from today', () => {
    expect(planTransition('activate', 'registered', '2026-04-21')).toEqual({
      action: 'activate',
      from: 'registered',
      to: 'active',
      activatedOn: '2026-04-21',
      billingEnd: null,
    });
  });

  it.each(['deactivate', 'archive', 'sell'] as const)(
    '%s stops the charge from the first day of next month',
    (action) => {
      expect(planTransition(action, 'active', '2026-04-05')).toMatchObject({
        activatedOn: null,
        billingEnd: '2026-05-01',
      });
    },
  );

  it('reactivates an archived machine with a new interval from today', () => {
    expect(
      planTransition('reactivate', 'archived', '2026-06-02'),
    ).toMatchObject({
      to: 'active',
      activatedOn: '2026-06-02',
      billingEnd: null,
    });
  });

  it('refuses a transition from the wrong state', () => {
    expect(planTransition('activate', 'active', '2026-04-05')).toBeNull();
    expect(planTransition('reactivate', 'registered', '2026-04-05')).toBeNull();
    expect(planTransition('deactivate', 'sold', '2026-04-05')).toBeNull();
    expect(planTransition('archive', 'archived', '2026-04-05')).toBeNull();
  });

  it('offers only the actions that apply, and none without the permission', () => {
    expect(listAvailableActions('registered', true)).toEqual(['activate']);
    expect(listAvailableActions('active', true)).toEqual([
      'deactivate',
      'archive',
    ]);
    expect(listAvailableActions('archived', true)).toEqual(['reactivate']);
    expect(listAvailableActions('sold', true)).toEqual([]);
    expect(listAvailableActions('active', false)).toEqual([]);
  });

  it('allows a transfer request only for an active machine', () => {
    expect(canRequestTransfer('active', true)).toBe(true);
    expect(canRequestTransfer('registered', true)).toBe(false);
    expect(canRequestTransfer('active', false)).toBe(false);
  });

  it('gives full history and AI only to active machines', () => {
    expect(hasFullMachineAccess('active')).toBe(true);
    expect(hasFullMachineAccess('registered')).toBe(false);
    expect(hasFullMachineAccess('archived')).toBe(false);
  });

  it('reads an unknown state as registered', () => {
    expect(toLifecycleState('mystery')).toBe('registered');
  });
});
