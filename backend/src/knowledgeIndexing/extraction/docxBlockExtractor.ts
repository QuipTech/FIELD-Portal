import * as mammoth from 'mammoth';
import {
  DocumentExtractionError,
  ExtractedDocument,
  TextBlock,
} from './documentBlocks';

const BLOCK_ELEMENTS = /<(h[1-6]|p|li|td|th)\b[^>]*>([\s\S]*?)<\/\1>/g;

const decodeEntities = (text: string): string =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

const toPlainText = (html: string): string =>
  decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

// DOCX has no fixed pages, so blocks carry no page number; Word's heading
// styles (Heading 1–6) come through mammoth as <h1>–<h6>.
export const extractDocx = async (
  bytes: Uint8Array,
): Promise<Omit<ExtractedDocument, 'pageCount'>> => {
  let html: string;
  try {
    html = (await mammoth.convertToHtml({ buffer: Buffer.from(bytes) })).value;
  } catch {
    throw new DocumentExtractionError(
      'This Word document is corrupt or unreadable. Re-save it and upload a new version.',
    );
  }
  const blocks: TextBlock[] = [];
  for (const [, tag, inner] of html.matchAll(BLOCK_ELEMENTS)) {
    const text = toPlainText(inner);
    if (text) blocks.push({ page: null, text, isHeading: tag.startsWith('h') });
  }
  return { blocks, imageOnlyPages: [] };
};
