const WORD = /[a-z0-9]+/g;
// Words too common to show that a line repeats the title.
const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'of',
  'a',
  'an',
  'to',
  'in',
  'on',
  'pdf',
  'docx',
  'doc',
]);
// A title block is a few short lines; anything longer is real content.
const MAX_TITLE_BLOCK_CHARS = 300;
const MIN_SHARED_WORDS = 2;

const toWords = (text: string): Set<string> =>
  new Set(
    (text.toLowerCase().match(WORD) ?? []).filter(
      (word) => !STOP_WORDS.has(word),
    ),
  );

// Whether the text at the very top of a document only repeats its title or
// file name ("Caterpillar 793F … Hydraulic System Maintenance Bulletin —
// MB-793F-2026-014"), which the article already shows as its title.
export const isTitleBlock = (
  text: string,
  title: string,
  fileName: string | null,
): boolean => {
  if (text.length > MAX_TITLE_BLOCK_CHARS) return false;
  const known = toWords(`${title} ${fileName ?? ''}`);
  const shared = [...toWords(text)].filter((word) => known.has(word)).length;
  return shared >= MIN_SHARED_WORDS;
};
