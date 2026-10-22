import { CatalogDocument, DocumentSectionRef } from './catalogResponse';

// GET /knowledge/documents/:id
export interface CatalogDocumentDetail extends CatalogDocument {
  // The saved AI summary, else the first section's opening paragraph.
  summary: string | null;
  // Table of contents of the live version; empty when nothing is live.
  sections: DocumentSectionRef[];
  // The page the caller was last on (POST /me/knowledge/recent).
  lastViewedPage: number | null;
  // Admins only (null for everyone else).
  reviewNote: string | null;
  errorMessage: string | null;
}

export interface PageSectionRef extends DocumentSectionRef {
  // false for the section that started on an earlier page and runs on.
  startsOnPage: boolean;
}

// GET /knowledge/documents/:id/pages/:n
export interface CatalogDocumentPage {
  documentId: string;
  versionId: string;
  versionNumber: number;
  page: number;
  pageCount: number | null;
  text: string;
  // 'page': the page's own text. 'sections': the sections on this page,
  // for versions indexed before page text was saved (re-index to upgrade).
  textSource: 'page' | 'sections';
  sections: PageSectionRef[];
  // Signed page image; null until page images are rendered.
  imageUrl: string | null;
  // Signed inline PDF link opening at this page; null without storage.
  pdfUrl: string | null;
}

// GET /knowledge/documents/:id/file — a 15-minute download link. Cache the
// file by versionId: a new id means the document was updated.
export interface CatalogDocumentFile {
  url: string;
  expiresAt: string;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  versionId: string;
  versionNumber: number;
}
