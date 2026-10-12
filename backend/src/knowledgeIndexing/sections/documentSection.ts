// A document as the Knowledge article page reads it: headings with their
// body text, in reading order. Saved per version (migration 0076).
export interface SectionFigure {
  page: number | null;
  caption: string;
}

export interface DocumentSection {
  // Position in the document, from 0; the article's anchor is `s{ordinal}`.
  ordinal: number;
  heading: string | null;
  // The page the section starts on; null for formats without pages (DOCX).
  page: number | null;
  content: string;
  figures: SectionFigure[];
}
