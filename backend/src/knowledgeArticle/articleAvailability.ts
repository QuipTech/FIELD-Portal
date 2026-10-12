import {
  deriveDocumentState,
  KnowledgeDocumentState,
} from '../knowledge/knowledgeFileRules';
import { ArticleDocumentRow } from './types/knowledgeArticleRows';

export interface UnreadableArticle {
  state: KnowledgeDocumentState;
  progress: number;
}

// Why the article can't be shown yet, or null when it can. It needs a
// live version, and the document mustn't be archived or awaiting review.
// A newer version still indexing doesn't hide the live one.
export const findArticleBlocker = (
  row: ArticleDocumentRow,
): UnreadableArticle | null =>
  row.live_version_id && !['archived', 'review'].includes(row.status)
    ? null
    : {
        state: deriveDocumentState(row.status, row.latest_ingestion_status),
        progress: row.latest_progress,
      };
