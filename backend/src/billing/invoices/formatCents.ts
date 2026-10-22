// 123456 → "$1,234.56" (AUD), for invoice text and emails.
export const formatCents = (cents: number, currency = 'AUD'): string =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(
    cents / 100,
  );
