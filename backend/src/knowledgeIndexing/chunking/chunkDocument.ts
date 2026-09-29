import { TextBlock } from '../extraction/documentBlocks';

export interface DocumentChunk {
  page: number | null;
  heading: string | null;
  content: string;
}

// Titan and most English text average ~4 characters per token; exact
// token counts aren't needed for ~800–1000-token chunks.
const CHARS_PER_TOKEN = 4;
const TARGET_CHARS = 900 * CHARS_PER_TOKEN;
const MAX_CHARS = 1000 * CHARS_PER_TOKEN;
const OVERLAP_CHARS = 100 * CHARS_PER_TOKEN;

interface Piece {
  page: number | null;
  text: string;
  isHeading: boolean;
}

// Long paragraphs are cut at sentence ends (or, failing that, at spaces)
// so no single piece is bigger than a chunk.
const splitLongText = (text: string): string[] => {
  if (text.length <= TARGET_CHARS) return [text];
  const pieces: string[] = [];
  let current = '';
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    if (current && current.length + sentence.length + 1 > TARGET_CHARS) {
      pieces.push(current);
      current = '';
    }
    if (sentence.length > MAX_CHARS) {
      for (let start = 0; start < sentence.length; start += TARGET_CHARS)
        pieces.push(sentence.slice(start, start + TARGET_CHARS));
      continue;
    }
    current = current ? `${current} ${sentence}` : sentence;
  }
  if (current) pieces.push(current);
  return pieces;
};

// The last ~100 tokens of a chunk, starting at a word boundary.
const overlapTail = (content: string): string => {
  if (content.length <= OVERLAP_CHARS) return content;
  const tail = content.slice(-OVERLAP_CHARS);
  const firstSpace = tail.indexOf(' ');
  return firstSpace === -1 ? tail : tail.slice(firstSpace + 1);
};

// ~900-token chunks with ~100 tokens of overlap. Each chunk keeps the page
// its new text starts on and the section heading in force there.
export const chunkBlocks = (blocks: TextBlock[]): DocumentChunk[] => {
  const pieces: Piece[] = blocks.flatMap((block) =>
    block.isHeading
      ? [block]
      : splitLongText(block.text).map((text) => ({ ...block, text })),
  );
  const chunks: DocumentChunk[] = [];
  let heading: string | null = null;
  let parts: string[] = [];
  let length = 0;
  let meta: { page: number | null; heading: string | null } | null = null;

  const emit = () => {
    if (!meta) return;
    const content = parts.join('\n').trim();
    if (content) chunks.push({ ...meta, content });
    const overlap = overlapTail(content);
    parts = overlap ? [overlap] : [];
    length = overlap.length;
    meta = null;
  };

  for (const piece of pieces) {
    if (piece.isHeading) heading = piece.text;
    if (meta && length + piece.text.length > MAX_CHARS) emit();
    meta ??= { page: piece.page, heading };
    parts.push(piece.text);
    length += piece.text.length + 1;
    if (length >= TARGET_CHARS) emit();
  }
  emit();
  return chunks;
};
