// Billing days are calendar dates ('YYYY-MM-DD') in the billing account's
// time zone (spec section 3, rule 1). Arithmetic runs on UTC midnights so
// a daylight-saving change can't move a day.

const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDay = (day: string): Date => {
  const match = ISO_DAY_PATTERN.exec(day);
  if (!match) throw new RangeError(`Not a billing day: ${day}`);
  const [, year, month, date] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(date)));
};

const formatDay = (utcMidnight: Date): string =>
  utcMidnight.toISOString().slice(0, 10);

// The billing day an instant falls on in the given time zone.
export const toBillingDay = (instant: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: string) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export const firstDayOfMonth = (day: string): string => {
  const date = parseDay(day);
  return formatDay(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)),
  );
};

// billing_end for a deactivation, archive, sale or seat removal on `day`.
export const firstDayOfNextMonth = (day: string): string => {
  const date = parseDay(day);
  return formatDay(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)),
  );
};

// Same day of the month `months` later, clamped to the last day of a
// shorter month (31 Jan + 1 month = 28 or 29 Feb).
export const addMonthsToDay = (day: string, months: number): string => {
  const date = parseDay(day);
  const targetMonth = date.getUTCMonth() + months;
  const lastDayOfTarget = new Date(
    Date.UTC(date.getUTCFullYear(), targetMonth + 1, 0),
  ).getUTCDate();
  return formatDay(
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        targetMonth,
        Math.min(date.getUTCDate(), lastDayOfTarget),
      ),
    ),
  );
};

export const addDaysToDay = (day: string, days: number): string => {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDay(date);
};
