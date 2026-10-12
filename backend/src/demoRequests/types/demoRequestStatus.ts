// Follow-up stages, in order. Must match the CHECK on
// platform.demo_requests.status (migration 0066).
export const DEMO_REQUEST_STATUSES = [
  'new',
  'contacted',
  'scheduled',
  'completed',
  'converted',
  'lost',
] as const;

export type DemoRequestStatus = (typeof DEMO_REQUEST_STATUSES)[number];
