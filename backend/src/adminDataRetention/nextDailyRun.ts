// Milliseconds from `now` until the next time the clock reads hourUtc:00
// UTC — later today, or tomorrow if that hour has passed.
export const msUntilNextDailyRun = (
  hourUtc: number,
  now = new Date(),
): number => {
  const next = new Date(now);
  next.setUTCHours(hourUtc, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
};
