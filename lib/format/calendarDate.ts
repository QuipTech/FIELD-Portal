// For YYYY-MM-DD calendar dates (no time or zone): formatted in UTC so the
// day never shifts with the viewer's time zone.
const calendarDateFormat = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// "2027-04-14" → "14 Apr 2027".
export const formatCalendarDate = (isoDay: string): string =>
  calendarDateFormat.format(new Date(`${isoDay}T00:00:00Z`));

// Whole days from one YYYY-MM-DD to another.
export const daysBetweenCalendarDates = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / (24 * 60 * 60 * 1000));
