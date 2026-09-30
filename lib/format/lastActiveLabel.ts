import type { AdminUser } from "../types/adminUser";
import { formatDayMonth, formatElapsedTime } from "./elapsedTimeLabel";

// Invited users haven't signed in yet, so show when they were invited.
export const formatLastActiveLabel = (user: AdminUser, now = new Date()): string => {
  if (user.status === "invited") {
    return `Invited ${formatDayMonth(new Date(user.createdAt), now)}`;
  }
  return user.lastActiveAt ? formatElapsedTime(new Date(user.lastActiveAt), now) : "Never";
};
