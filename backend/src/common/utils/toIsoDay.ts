// pg returns a `date` column as a Date at local midnight; format it with
// local getters so the day doesn't shift the way toISOString() would.
export const toIsoDay = (day: Date): string =>
  [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, '0'),
    String(day.getDate()).padStart(2, '0'),
  ].join('-');
