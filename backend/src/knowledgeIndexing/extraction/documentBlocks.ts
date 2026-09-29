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
