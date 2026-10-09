export interface ArticleFigure {
  page: number | null;
  caption: string;
  // Null until page images are extracted: show a captioned placeholder.
  imageUrl: string | null;
}

export interface ArticleSection {
  // The page anchor, e.g. "s3".
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
  page: number | null;
}

// GET /documents/:id/article
export interface KnowledgeArticle {
  id: string;
  title: string;
  type: string;
  machineMake: string | null;
  machineModel: string | null;
  revision: number;
  pageCount: number | null;
  source: "tenant" | "quiptech_library";
  state: "live";
  fileName: string | null;
  // Opens the PDF in the browser; expires after 15 minutes.
  pdfUrl: string | null;
  summary: string | null;
  sections: ArticleSection[];
  related: ArticleDocumentLink[];
  appliesBulletins: { id: string; title: string }[];
}
