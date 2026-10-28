// A billing day (YYYY-MM-DD) as "1 November 2026"; dates have no time zone.
export const formatBillingDay = (day: string): string =>
  new Date(`${day.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// "October 2026" for a month's first day.
export const formatBillingMonth = (day: string): string =>
  new Date(`${day.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
