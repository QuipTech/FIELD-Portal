import { TextBlock } from '../extraction/documentBlocks';
import { DocumentSection, SectionFigure } from './documentSection';
import { isTitleBlock } from './titleBlock';
import { toParagraphs } from './toParagraphs';

// "Figure 3 – Pump layout", "Fig. 2: Bleed points".
const FIGURE_CAPTION = /^(figure|fig\.?)\s*\d+[a-z]?\b/i;

interface SectionDraft {
  heading: string | null;
  page: number | null;
  // Body text, one entry per extracted block, already in paragraphs.
  lines: string[];
  figures: SectionFigure[];
}

const isEmpty = (draft: SectionDraft) =>
  draft.lines.length === 0 && draft.figures.length === 0;

const toText = (draft: SectionDraft) =>
  [draft.heading, ...draft.lines].filter(Boolean).join('\n');

// Splits extracted blocks into the article's sections: a new section at
// every heading, body text and figure captions under the heading in force.
// Headings with nothing under them are dropped (e.g. a chapter title
// straight before its first subsection), and so is a title block at the
// top that only repeats the document's title or file name.
export const buildDocumentSections = (
  blocks: TextBlock[],
  document: { title: string; fileName: string | null },
): DocumentSection[] => {
  const drafts: SectionDraft[] = [];
  let current: SectionDraft = {
    heading: null,
    page: null,
    lines: [],
    figures: [],
  };
  const startSection = (heading: string, page: number | null) => {
    if (!isEmpty(current)) drafts.push(current);
    current = { heading, page, lines: [], figures: [] };
  };

  for (const block of blocks) {
    const text = block.text.trim();
    if (!text) continue;
    if (block.isHeading) {
      startSection(text, block.page);
      continue;
    }
    current.page ??= block.page;
    const bodyLines: string[] = [];
    for (const line of text
      .split('\n')
      .map((part) => part.trim())
      .filter(Boolean)) {
      if (FIGURE_CAPTION.test(line))
        current.figures.push({ page: block.page, caption: line });
      else bodyLines.push(line);
    }
    if (bodyLines.length) current.lines.push(toParagraphs(bodyLines));
  }
  if (!isEmpty(current)) drafts.push(current);

  const [first, ...rest] = drafts;
  const kept =
    first &&
    rest.length &&
    isTitleBlock(toText(first), document.title, document.fileName)
      ? rest
      : drafts;
  return kept.map((draft, ordinal) => ({
    ordinal,
    heading: draft.heading,
    page: draft.page,
    content: draft.lines.join('\n\n'),
    figures: draft.figures,
  }));
};
