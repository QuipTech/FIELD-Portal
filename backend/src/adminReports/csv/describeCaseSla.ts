const HOUR_MS = 60 * 60 * 1000;

export type CaseSlaStatus = 'Met' | 'Missed' | 'Within target' | 'Breaching';

// Same rule as the dashboard: the target runs from when the case was
// created, until it's resolved (or until now while it's still open).
export const describeCaseSla = (
  createdAt: Date,
  resolvedAt: Date | null,
  targetHours: number,
  now: Date,
): { hoursOpen: number; status: CaseSlaStatus } => {
  const end = resolvedAt ?? now;
  const hoursOpen = (end.getTime() - createdAt.getTime()) / HOUR_MS;
  const isWithinTarget = hoursOpen <= targetHours;
  const status: CaseSlaStatus = resolvedAt
    ? isWithinTarget
      ? 'Met'
      : 'Missed'
    : isWithinTarget
      ? 'Within target'
      : 'Breaching';
  return { hoursOpen: Math.round(hoursOpen * 10) / 10, status };
};
