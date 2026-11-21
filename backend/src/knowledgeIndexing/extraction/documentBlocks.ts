// A run of text from a document: a heading, or body text from one page
// (page is null for formats without pages, e.g. DOCX).
export interface TextBlock {
  page: number | null;
  text: string;
  isHeading: boolean;
}

export interface ExtractedDocument {
  blocks: TextBlock[];
  pageCount: number | null;
  // PDF pages with (almost) no text layer — scanned images; OCR candidates.
  imageOnlyPages: number[];
}

// A problem with the file itself; the message is shown to admins as the
// document's error, so it says what to do about it.
export class DocumentExtractionError extends Error {}

export const UNSUPPORTED_DOC_MESSAGE =
  'Legacy Word (.doc) files can’t be indexed. Save it as PDF or DOCX and upload a new version.';

// Postgres text columns reject NUL (U+0000) with "invalid byte sequence
// for encoding UTF8: 0x00", and some PDFs' text layers contain it. It has
// no meaning in text, so it is removed before anything is stored.
export const removeNulCharacters = (
  document: ExtractedDocument,
): ExtractedDocument => ({
  ...document,
  blocks: document.blocks.map((block) =>
    block.text.includes('\u0000')
      ? { ...block, text: block.text.replace(/\u0000/g, '') }
      : block,
  ),
});
