import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js';
import {
  DocumentExtractionError,
  ExtractedDocument,
  TextBlock,
} from './documentBlocks';

interface PdfTextItem {
  str: string;
  transform: number[];
}

interface PdfLine {
  page: number;
  text: string;
  fontSize: number;
}

// Pages with fewer characters than this are treated as scanned images.
const MIN_TEXT_CHARS_PER_PAGE = 20;
const HEADING_FONT_RATIO = 1.15;
const MAX_HEADING_CHARS = 120;
// "1. Purpose", "3.2 Hydraulic pump", "A. Safety" — numbered section
// titles. A lone number needs its "." or ")", so a table row such as
// "2 Check main relief valve setting 2850 PSI" isn't taken for a heading.
const NUMBERED_HEADING = /^(\d+(\.\d+)+[.)]?|\d+[.)]|[A-Z][.)])\s+\S.{0,78}$/;

// pdf.js text items on the same baseline (y) form one line.
const toLines = (page: number, items: PdfTextItem[]): PdfLine[] => {
  const lines: PdfLine[] = [];
  let current: { y: number; parts: string[]; fontSize: number } | null = null;
  for (const item of items) {
    const y = item.transform[5];
    const fontSize = Math.abs(item.transform[3]) || Math.abs(item.transform[0]);
    if (current && Math.abs(current.y - y) <= Math.max(2, fontSize * 0.3)) {
      current.parts.push(item.str);
      current.fontSize = Math.max(current.fontSize, fontSize);
      continue;
    }
    if (current)
      lines.push({
        page,
        text: current.parts.join(' '),
        fontSize: current.fontSize,
      });
    current = { y, parts: [item.str], fontSize };
  }
  if (current)
    lines.push({
      page,
      text: current.parts.join(' '),
      fontSize: current.fontSize,
    });
  return lines
    .map((line) => ({ ...line, text: line.text.replace(/\s+/g, ' ').trim() }))
    .filter((line) => line.text);
};

const medianFontSize = (lines: PdfLine[]): number => {
  const sizes = lines.map((line) => line.fontSize).sort((a, b) => a - b);
  return sizes[Math.floor(sizes.length / 2)] ?? 0;
};

const couldBeHeading = (text: string): boolean =>
  text.length <= MAX_HEADING_CHARS &&
  /[A-Za-z]/.test(text) &&
  !/[.,;:]$/.test(text);

// A numbered section title, judged from its text alone (no font sizes).
export const isNumberedHeading = (text: string): boolean =>
  couldBeHeading(text) && NUMBERED_HEADING.test(text);

const isHeadingLine = (line: PdfLine, bodyFontSize: number): boolean =>
  couldBeHeading(line.text) &&
  ((bodyFontSize > 0 && line.fontSize >= bodyFontSize * HEADING_FONT_RATIO) ||
    NUMBERED_HEADING.test(line.text));

// Headings become their own blocks; the body text between them on a page
// is one block (the chunker splits it further).
const toBlocks = (lines: PdfLine[]): TextBlock[] => {
  const bodyFontSize = medianFontSize(lines);
  const blocks: TextBlock[] = [];
  let body: PdfLine[] = [];
  const flushBody = () => {
    if (body.length)
      blocks.push({
        page: body[0].page,
        text: body.map((line) => line.text).join('\n'),
        isHeading: false,
      });
    body = [];
  };
  for (const line of lines) {
    if (body.length && body[0].page !== line.page) flushBody();
    if (isHeadingLine(line, bodyFontSize)) {
      flushBody();
      blocks.push({ page: line.page, text: line.text, isHeading: true });
    } else {
      body.push(line);
    }
  }
  flushBody();
  return blocks;
};

const toExtractionError = (error: unknown): DocumentExtractionError => {
  const name = (error as { name?: string })?.name ?? '';
  if (name === 'PasswordException') {
    return new DocumentExtractionError(
      'This PDF is password-protected. Upload a version without a password.',
    );
  }
  return new DocumentExtractionError(
    'This PDF is corrupt or unreadable. Re-export it and upload a new version.',
  );
};

interface PdfDocumentHandle {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{ items: unknown[] }>;
    cleanup: () => void;
  }>;
  destroy: () => Promise<void>;
}

// pdf.js v3's CommonJS build (pdfjs-dist 3.11). isEvalSupported: false
// is required: it closes CVE-2024-4367 (code execution via a crafted font).
const openPdf = async (bytes: Uint8Array): Promise<PdfDocumentHandle> => {
  try {
    const task = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0,
    });
    return (await task.promise) as unknown as PdfDocumentHandle;
  } catch (error) {
    throw toExtractionError(error);
  }
};

const readPageLines = async (
  pdf: PdfDocumentHandle,
  pageNumber: number,
): Promise<PdfLine[]> => {
  try {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    page.cleanup();
    const items = content.items.filter(
      (item): item is PdfTextItem =>
        typeof (item as PdfTextItem).str === 'string',
    );
    return toLines(pageNumber, items);
  } catch (error) {
    throw toExtractionError(error);
  }
};

// Text of every page, in reading order. onPage reports progress (and may
// throw to cancel — that isn't treated as a file problem).
export const extractPdf = async (
  bytes: Uint8Array,
  onPage: (pagesDone: number, totalPages: number) => Promise<void>,
): Promise<ExtractedDocument> => {
  const pdf = await openPdf(bytes);
  const lines: PdfLine[] = [];
  const imageOnlyPages: number[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const pageLines = await readPageLines(pdf, pageNumber);
      const chars = pageLines.reduce(
        (total, line) => total + line.text.length,
        0,
      );
      if (chars < MIN_TEXT_CHARS_PER_PAGE) imageOnlyPages.push(pageNumber);
      lines.push(...pageLines);
      await onPage(pageNumber, pdf.numPages);
    }
  } finally {
    await pdf.destroy();
  }
  return { blocks: toBlocks(lines), pageCount: pdf.numPages, imageOnlyPages };
};
