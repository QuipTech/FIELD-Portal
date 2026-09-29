// For LIKE/ILIKE search on user-typed text: a literal %, _ or \ typed by
// the user must not act as a wildcard or escape.
export const escapeLikePattern = (text: string): string =>
  text.replace(/[\\%_]/g, '\\$&');
