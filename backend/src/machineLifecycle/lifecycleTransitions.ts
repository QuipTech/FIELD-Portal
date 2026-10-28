import { firstDayOfNextMonth } from '../billing/billingCalendar/billingDay';

// Activate, deactivate, archive, reactivate and transfer (migration 0097).
export const MACHINE_LIFECYCLE_PERMISSION = 'machine.lifecycle';

// FIELD billing spec section 4: four states, five transitions. Only an
// active machine is billed; leaving active stops the charge from the
// first day of next month.
export const LIFECYCLE_STATES = [
  'registered',
  'active',
  'archived',
  'sold',
] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

// Transfer completes as 'sell' once the receiving organisation approves.
export const LIFECYCLE_ACTIONS = [
  'activate',
  'deactivate',
  'archive',
  'reactivate',
  'sell',
] as const;
export type LifecycleAction = (typeof LIFECYCLE_ACTIONS)[number];

// Actions an administrator applies directly; 'sell' only via a transfer.
export const DIRECT_LIFECYCLE_ACTIONS: LifecycleAction[] = [
  'activate',
  'deactivate',
  'archive',
  'reactivate',
];

interface Transition {
  from: LifecycleState;
  to: LifecycleState;
}

const TRANSITIONS: Record<LifecycleAction, Transition> = {
  activate: { from: 'registered', to: 'active' },
  deactivate: { from: 'active', to: 'registered' },
  archive: { from: 'active', to: 'archived' },
  reactivate: { from: 'archived', to: 'active' },
  sell: { from: 'active', to: 'sold' },
};

export interface PlannedTransition extends Transition {
  action: LifecycleAction;
  // Set when the machine becomes active: counted from this day.
  activatedOn: string | null;
  // Set when the machine stops being active: counted until (not
  // including) this day.
  billingEnd: string | null;
}

// null when the action doesn't apply to the machine's current state.
export const planTransition = (
  action: LifecycleAction,
  current: LifecycleState,
  today: string,
): PlannedTransition | null => {
  const transition = TRANSITIONS[action];
  if (transition.from !== current) return null;
  return {
    action,
    ...transition,
    activatedOn: transition.to === 'active' ? today : null,
    billingEnd:
      transition.from === 'active' ? firstDayOfNextMonth(today) : null,
  };
};

// What the caller may do next, for the portal's action menu. Transfer is
// offered separately (it needs a receiving organisation).
export const listAvailableActions = (
  current: LifecycleState,
  canManageLifecycle: boolean,
): LifecycleAction[] =>
  canManageLifecycle
    ? DIRECT_LIFECYCLE_ACTIONS.filter(
        (action) => TRANSITIONS[action].from === current,
      )
    : [];

export const canRequestTransfer = (
  current: LifecycleState,
  canManageLifecycle: boolean,
): boolean => canManageLifecycle && current === TRANSITIONS.sell.from;

// Full history, AI context and remote sessions need an active machine;
// any other state shows identity and summary only.
export const hasFullMachineAccess = (current: LifecycleState): boolean =>
  current === 'active';

export const toLifecycleState = (value: string): LifecycleState =>
  (LIFECYCLE_STATES as readonly string[]).includes(value)
    ? (value as LifecycleState)
    : 'registered';
