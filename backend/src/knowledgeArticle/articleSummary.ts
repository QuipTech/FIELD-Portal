const MAX_SUMMARY_CHARS = 400;

// The article's opening paragraph: the AI summary saved while indexing,
// when there is one, else the first paragraph of the first section (cut at
// a sentence end if it runs long).
export const toArticleSummary = (
  savedSummary: string | null,
  firstSectionContent: string | null,
): string | null => {
  if (savedSummary?.trim()) return savedSummary.trim();
  const paragraph = firstSectionContent?.split('\n\n')[0]?.trim();
  if (!paragraph) return null;
  if (paragraph.length <= MAX_SUMMARY_CHARS) return paragraph;
  const cut = paragraph.slice(0, MAX_SUMMARY_CHARS);
  const sentenceEnd = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('! '),
    cut.lastIndexOf('? '),
  );
  return sentenceEnd > 0
    ? cut.slice(0, sentenceEnd + 1)
    : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
};
