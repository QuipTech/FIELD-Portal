export interface ArticleFigure {
  page: number | null;
  caption: string;
  // Signed URL of the extracted page image; null until page images are
  // rendered — the portal shows a captioned placeholder.
  imageUrl: string | null;
}

export interface ArticleSection {
  // The page anchor: `s{ordinal}`.
  id: string;
  heading: string | null;
  page: number | null;
  // Paragraphs separated by a blank line.
  content: string;
  figures: ArticleFigure[];
}

export interface ArticleDocumentLink {
  id: string;
  title: string;
  type: string;
  // The page that best matches this document; null when unknown.
  page: number | null;
}

// GET /documents/:id/article
export interface KnowledgeArticle {
  id: string;
  title: string;
  type: string;
  machineMake: string | null;
  machineModel: string | null;
  // The live version's number.
  revision: number;
  pageCount: number | null;
  source: 'tenant' | 'quiptech_library';
  state: 'live';
  fileName: string | null;
  // A 15-minute link that opens the PDF in the browser (not a download);
  // null when the file can't be signed (no storage configured).
  pdfUrl: string | null;
  summary: string | null;
  sections: ArticleSection[];
  related: ArticleDocumentLink[];
  appliesBulletins: { id: string; title: string }[];
}
