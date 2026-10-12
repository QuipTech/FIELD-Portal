import { AuditLogEvent } from '../../adminAuditLog/types/auditLogResponse';

export type IngestionQueueState =
  'queued' | 'indexing' | 'failed' | 'needs_review';

export interface IngestionQueueEntry {
  // The knowledge item id (GET /documents/:id/…).
  id: string;
  title: string;
  // null for the shared library.
  organisationName: string | null;
  state: IngestionQueueState;
  // 0–100 while indexing.
  progress: number;
  pageCount: number | null;
  errorMessage: string | null;
  // 1 = next in line (queued only).
  queuePosition: number | null;
  uploadedBy: string | null;
  uploadedAt: string;
}

// The admin Overview page, for the caller's AdminScope (every organisation
// for the Owner).
export interface AdminOverview {
  scope: {
    isPlatform: boolean;
    // The scoped organisation's name; null when every organisation is shown.
    organisationName: string | null;
    organisationCount: number;
    siteCount: number;
  };
  users: { active: number; invited: number };
  documents: {
    // Searchable now (a live version), shared library included.
    indexed: number;
    // Share of uploaded pages that are searchable; null with no pages yet.
    searchablePagePercent: number | null;
  };
  assets: { total: number; modelCount: number };
  ingestionQueue: IngestionQueueEntry[];
  latestActions: AuditLogEvent[];
}
