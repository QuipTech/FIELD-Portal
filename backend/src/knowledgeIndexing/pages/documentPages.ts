import { DatabaseService } from '../../database/database.service';
import { TextBlock } from '../extraction/documentBlocks';

export interface DocumentPage {
  page: number;
  content: string;
}

// Each page's text in reading order, headings included. Blocks without a
// page (DOCX) give no pages: the app falls back to sections for those.
export const buildDocumentPages = (blocks: TextBlock[]): DocumentPage[] => {
  const pages = new Map<number, string[]>();
  for (const block of blocks) {
    if (block.page === null || !block.text.trim()) continue;
    pages.set(block.page, [...(pages.get(block.page) ?? []), block.text]);
  }
  return [...pages.entries()]
    .sort(([a], [b]) => a - b)
    .map(([page, texts]) => ({ page, content: texts.join('\n') }));
};

// Via SECURITY DEFINER replace_document_pages() (migration 0102), like the
// sections; re-indexing a version replaces what an earlier run saved.
export const replaceDocumentPages = async (
  databaseService: DatabaseService,
  versionId: string,
  pages: DocumentPage[],
): Promise<void> => {
  await databaseService.query('SELECT replace_document_pages($1, $2)', [
    versionId,
    JSON.stringify(pages),
  ]);
};
