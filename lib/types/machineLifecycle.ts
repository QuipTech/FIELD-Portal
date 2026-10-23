// Billing lifecycle: only active machines are billed and show full history,
// configuration, photos and AI. New machines start registered.
export type LifecycleState = "registered" | "active" | "archived" | "sold";

export type LifecycleAction = "activate" | "deactivate" | "archive" | "reactivate" | "sell";

// POST /machines/:machineId/lifecycle
export interface LifecycleChangeResult {
  machineId: string;
  action: LifecycleAction;
  fromState: LifecycleState;
  lifecycleState: LifecycleState;
  // Billing days (YYYY-MM-DD) in the billing account's time zone.
  countedFrom: string | null;
  billedUntilExclusive: string | null;
  enterpriseReviewRaised: boolean;
}
