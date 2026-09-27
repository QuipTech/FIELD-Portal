import type { AdminUser } from "../types/adminUser";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// "28 Feb", or "28 Feb 2025" when it isn't this year.
const formatShortDate = (date: Date, now: Date): string =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });

const formatElapsed = (date: Date, now: Date): string => {
  const elapsedMs = now.getTime() - date.getTime();
  if (elapsedMs < MINUTE_MS) return "Now";
  if (elapsedMs < HOUR_MS) return `${Math.floor(elapsedMs / MINUTE_MS)} min ago`;
  if (elapsedMs < DAY_MS) return `${Math.floor(elapsedMs / HOUR_MS)} h ago`;
  return formatShortDate(date, now);
};

// Invited users haven't signed in yet, so show when they were invited.
export const formatLastActiveLabel = (user: AdminUser, now = new Date()): string => {
  if (user.status === "invited") {
    return `Invited ${formatShortDate(new Date(user.createdAt), now)}`;
  }
  return user.lastActiveAt ? formatElapsed(new Date(user.lastActiveAt), now) : "Never";
};
