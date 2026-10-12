import { TextBlock } from '../extraction/documentBlocks';
import { isNumberedHeading } from '../extraction/pdfPageExtractor';

export interface StoredChunk {
  chunk_text: string;
  page_number: number | null;
  section_heading: string | null;
}

// Chunks repeat the end of the previous one (~100 tokens, chunkDocument.ts);
// this is the longest overlap looked for.
const MAX_OVERLAP_CHARS = 600;
const MIN_OVERLAP_CHARS = 20;

// The chunk's text without the part repeated from the previous chunk.
export const withoutOverlap = (previous: string, current: string): string => {
  const limit = Math.min(previous.length, current.length, MAX_OVERLAP_CHARS);
  for (let length = limit; length >= MIN_OVERLAP_CHARS; length -= 1) {
    if (previous.endsWith(current.slice(0, length)))
      return current.slice(length).replace(/^\s+/, '');
  }
  return current;
};

// For versions indexed before sections were saved (migration 0076): turns
// the stored chunks back into text blocks. A line is a heading when it is
// the chunk's own heading or a numbered section title ("3.2 Hydraulic
// pump"); the body lines between headings form one block, on its chunk's
// start page.
export const blocksFromChunks = (chunks: StoredChunk[]): TextBlock[] => {
  const blocks: TextBlock[] = [];
  let body: string[] = [];
  let bodyPage: number | null = null;
  const flushBody = () => {
    if (body.length)
      blocks.push({ page: bodyPage, text: body.join('\n'), isHeading: false });
    body = [];
  };
  chunks.forEach((chunk, index) => {
    const text =
      index === 0
        ? chunk.chunk_text
        : withoutOverlap(chunks[index - 1].chunk_text, chunk.chunk_text);
    for (const line of text
      .split('\n')
      .map((part) => part.trim())
      .filter(Boolean)) {
      if (line === chunk.section_heading || isNumberedHeading(line)) {
        flushBody();
        blocks.push({ page: chunk.page_number, text: line, isHeading: true });
        continue;
      }
      if (!body.length) bodyPage = chunk.page_number;
      body.push(line);
    }
  });
  flushBody();
  return blocks;
};
