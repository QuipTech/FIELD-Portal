const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_DAYS = 7;

// "28 Feb", or "28 Feb 2025" when it isn't this year.
export const formatDayMonth = (date: Date, now = new Date()): string =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });

// "Now", "24 min ago", "2 h ago", "Yesterday", "3 days ago", then the date.
export const formatElapsedTime = (date: Date, now = new Date()): string => {
  const elapsedMs = now.getTime() - date.getTime();
  if (elapsedMs < MINUTE_MS) return "Now";
  if (elapsedMs < HOUR_MS) return `${Math.floor(elapsedMs / MINUTE_MS)} min ago`;
  if (elapsedMs < DAY_MS) return `${Math.floor(elapsedMs / HOUR_MS)} h ago`;
  const days = Math.floor(elapsedMs / DAY_MS);
  if (days === 1) return "Yesterday";
  if (days < WEEK_DAYS) return `${days} days ago`;
  return formatDayMonth(date, now);
};
