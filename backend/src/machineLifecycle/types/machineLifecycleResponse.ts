import { LifecycleAction, LifecycleState } from '../lifecycleTransitions';

export interface LifecycleChangeResult {
  machineId: string;
  action: LifecycleAction;
  fromState: LifecycleState;
  lifecycleState: LifecycleState;
  // Billing days in the account's time zone, for the confirmation shown.
  countedFrom: string | null;
  billedUntilExclusive: string | null;
  enterpriseReviewRaised: boolean;
}

export interface BulkLifecycleResult {
  applied: LifecycleChangeResult[];
  failed: { machineId: string; message: string }[];
}

export interface LifecycleEvent {
  id: string;
  fromState: string;
  toState: string;
  reason: string | null;
  occurredAt: string;
  // null when the actor isn't in the caller's organisation.
  actorName: string | null;
  transferId: string | null;
}

export interface MachineLifecycle {
  machineId: string;
  lifecycleState: LifecycleState;
  availableActions: LifecycleAction[];
  canRequestTransfer: boolean;
  events: LifecycleEvent[];
}
