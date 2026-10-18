// Return plain text matches, never HTML, so portal/mobile can highlight safely.
export const snippetHighlights = (
  snippet: string | null,
  query: string | undefined,
): string[] => {
  if (!snippet || !query) return [];
  const terms = Array.from(
    new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []),
  ).filter((word) => word.length > 1);
  const words = snippet.match(/[\p{L}\p{N}]+/gu) ?? [];
  return Array.from(
    new Set(words.filter((word) => terms.includes(word.toLowerCase()))),
  );
};
