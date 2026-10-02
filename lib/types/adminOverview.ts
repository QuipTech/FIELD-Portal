// Mirrors backend/src/adminOverview/types/adminOverviewResponse.ts.
import type { AuditLogEvent } from "./auditLog";

export type IngestionQueueState = "queued" | "indexing" | "failed" | "needs_review";

export interface IngestionQueueEntry {
  id: string;
  title: string;
  // null for the shared library.
  organisationName: string | null;
  state: IngestionQueueState;
  progress: number;
  pageCount: number | null;
  errorMessage: string | null;
  // 1 = next in line (queued only).
  queuePosition: number | null;
  uploadedBy: string | null;
  uploadedAt: string;
}

export interface AdminOverview {
  scope: {
    isPlatform: boolean;
    // The narrowed organisation's name; null when every organisation is shown.
    organisationName: string | null;
    organisationCount: number;
    siteCount: number;
  };
  users: { active: number; invited: number };
  documents: { indexed: number; searchablePagePercent: number | null };
  assets: { total: number; modelCount: number };
  ingestionQueue: IngestionQueueEntry[];
  latestActions: AuditLogEvent[];
}
