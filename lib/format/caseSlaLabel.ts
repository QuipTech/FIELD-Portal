const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

export type CaseSlaState =
  | { kind: "left"; label: string }
  | { kind: "paused"; label: string }
  | { kind: "breached"; label: string };

const formatTimeLeft = (ms: number): string => {
  if (ms >= DAY_MS) return `${Math.floor(ms / DAY_MS)} d left`;
  if (ms >= HOUR_MS) return `${Math.floor(ms / HOUR_MS)} h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))} min left`;
};

// SLA time left as the queue shows it: "3 h left", "Paused" while waiting
// on the customer (the clock stopped), "Breached" once past due, null when
// the case no longer has a target (resolved or closed).
export const describeCaseSla = (
  slaDueAt: string | null,
  slaPausedAt: string | null,
  isActive: boolean,
  now = new Date(),
): CaseSlaState | null => {
  if (!slaDueAt || !isActive) return null;
  const measuredAt = slaPausedAt ? new Date(slaPausedAt) : now;
  const remainingMs = new Date(slaDueAt).getTime() - measuredAt.getTime();
  if (remainingMs < 0) return { kind: "breached", label: "Breached" };
  if (slaPausedAt) return { kind: "paused", label: "Paused" };
  return { kind: "left", label: formatTimeLeft(remainingMs) };
};
