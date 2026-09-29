const shortDateFormat = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });
const shortDateTimeFormat = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// "2026-03-19T…" → "19 Mar".
export const formatShortDate = (isoDate: string): string => shortDateFormat.format(new Date(isoDate));

// "2026-03-19T09:14…" → "19 Mar, 09:14" (in the viewer's time zone).
export const formatShortDateTime = (isoDate: string): string => shortDateTimeFormat.format(new Date(isoDate));
