// Quotes a cell when needed. A leading =, +, -, @, tab or CR would be run
// as a formula by Excel/Sheets, so such cells are prefixed with ' — the
// exports contain user-typed names and titles.
export const toCsvCell = (value: string): string => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// A header row plus data rows as CRLF-separated CSV text.
export const toCsvText = (rows: string[][]): string =>
  rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n') + '\r\n';
