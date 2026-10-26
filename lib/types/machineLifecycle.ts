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

// What activating machines adds to this month's bill (GET
// /machines/lifecycle/activation-quote). Amounts are AUD cents ex GST.
export type ActivationQuote =
  | { pricing: "contract"; timezone: string; invoicedOn: string }
  | {
      pricing: "per_machine";
      term: "monthly" | "annual";
      committedQty: number | null;
      timezone: string;
      // The 1st of next month: when this month's peak is invoiced.
      invoicedOn: string;
      activeToday: number;
      machinesAfter: number;
      billableBefore: number;
      billableAfter: number;
      rateBeforeCents: number | null;
      rateAfterCents: number;
      monthlyBeforeCents: number;
      monthlyAfterCents: number;
      bands: { from: number; to: number | null; unitCents: number }[];
    };

export interface BulkLifecycleResult {
  applied: LifecycleChangeResult[];
  failed: { machineId: string; message: string }[];
}

// GET /machines/:machineId/lifecycle
export interface LifecycleEvent {
  id: string;
  fromState: string;
  toState: string;
  reason: string | null;
  occurredAt: string;
  // null when the actor isn't in your organisation.
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

export type TransferStatus = "requested" | "rejected" | "cancelled" | "completed";

export interface MachineTransfer {
  id: string;
  machineId: string;
  machine: { label: string; serialNumber: string; manufacturer: string; model: string };
  fromOrganisation: { id: string; name: string };
  toOrganisation: { id: string; name: string };
  status: TransferStatus;
  reason: string;
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
}
