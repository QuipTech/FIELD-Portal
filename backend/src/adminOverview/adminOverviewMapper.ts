import { deriveDocumentState } from '../knowledge/knowledgeFileRules';
import {
  IngestionQueueRow,
  OverviewSummaryRow,
} from './types/adminOverviewRows';
import {
  AdminOverview,
  IngestionQueueEntry,
  IngestionQueueState,
} from './types/adminOverviewResponse';

const QUEUE_STATES: IngestionQueueState[] = [
  'queued',
  'indexing',
  'failed',
  'needs_review',
];

// Rounded down, so 99.6% isn't shown as "100% searchable".
export const toSearchablePercent = (
  searchablePages: number,
  totalPages: number,
): number | null =>
  totalPages > 0
    ? Math.min(100, Math.floor((searchablePages / totalPages) * 100))
    : null;

// Same state rules as the Knowledge screen (deriveDocumentState).
export const toIngestionQueueEntry = (
  row: IngestionQueueRow,
): IngestionQueueEntry | null => {
  const state = deriveDocumentState(row.item_status, row.ingestion_status);
  if (!QUEUE_STATES.includes(state as IngestionQueueState)) return null;
  return {
    id: row.item_id,
    title: row.title,
    organisationName: row.organisation_name,
    state: state as IngestionQueueState,
    progress: Number(row.progress ?? 0),
    pageCount: row.page_count,
    errorMessage: row.error_message,
    queuePosition: row.queue_position ? Number(row.queue_position) : null,
    uploadedBy: row.uploaded_by_name,
    uploadedAt: new Date(row.uploaded_at).toISOString(),
  };
};

export const toOverviewFigures = (
  row: OverviewSummaryRow,
): Pick<AdminOverview, 'users' | 'documents' | 'assets'> & {
  organisationCount: number;
  siteCount: number;
} => ({
  users: {
    active: Number(row.active_users),
    invited: Number(row.invited_users),
  },
  documents: {
    indexed: Number(row.documents_indexed),
    searchablePagePercent: toSearchablePercent(
      Number(row.pages_searchable),
      Number(row.pages_total),
    ),
  },
  assets: { total: Number(row.assets), modelCount: Number(row.models_in_use) },
  organisationCount: Number(row.organisations),
  siteCount: Number(row.sites),
});
