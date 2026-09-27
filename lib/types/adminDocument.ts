import type { IconName } from "@/components/icons/icon";
import type { Tone } from "@/components/ui/tone";

export type KnowledgeDocumentType = "manual" | "bulletin" | "procedure" | "policy" | "parts_book";
export type KnowledgeDocumentState =
  | "uploading"
  | "queued"
  | "indexing"
  | "failed"
  | "needs_review"
  | "live"
  | "archived";

// States that change on their own (the backend worker); poll until final.
export const IN_PROGRESS_DOCUMENT_STATES: KnowledgeDocumentState[] = ["queued", "indexing"];

// One document in the shared knowledge library (visible to every organisation).
export interface KnowledgeDocument {
  id: string;
  // True for the QuipTech library every organisation shares.
  isShared: boolean;
  title: string;
  // Usually a KnowledgeDocumentType; older items may hold other types.
  type: string;
  status: string;
  state: KnowledgeDocumentState;
  // uploading | pending | parsing | chunking | embedding | ready | failed
  ingestionStatus: string;
  // 0–100 while indexing.
  progress: number;
  // Why indexing failed, in words an admin can act on.
  errorMessage: string | null;
  versionNumber: number;
  // Why a bulletin/policy was rejected.
  reviewNote: string | null;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  pageCount: number | null;
  // True until the backend has counted the pages (it does so in the
  // background after upload); poll while any document is pending.
  isPageCountPending: boolean;
  indexedAt: string | null;
  createdAt: string;
}

export interface KnowledgeDocumentList {
  documents: KnowledgeDocument[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SignedUrl {
  url: string;
  expiresAt: string;
}

export interface KnowledgeUploadTicket {
  document: KnowledgeDocument;
  upload: SignedUrl & { method: "PUT"; headers: Record<string, string> };
}

export interface CreateKnowledgeUploadPayload {
  title: string;
  type: KnowledgeDocumentType;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export const knowledgeDocumentTypes: { value: KnowledgeDocumentType; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "bulletin", label: "Bulletin" },
  { value: "procedure", label: "Procedure" },
  { value: "policy", label: "Policy" },
  { value: "parts_book", label: "Parts book" },
];

export const documentStateLabel: Record<KnowledgeDocumentState, string> = {
  uploading: "Uploading",
  queued: "Queued",
  indexing: "Indexing",
  failed: "Failed",
  needs_review: "Needs review",
  live: "Live",
  archived: "Archived",
};

export const documentStateTone: Record<KnowledgeDocumentState, Tone> = {
  uploading: "default",
  queued: "default",
  indexing: "default",
  failed: "danger",
  needs_review: "amber",
  live: "primary",
  archived: "default",
};

// GET /documents/:id/status
export interface DocumentStatus {
  state: KnowledgeDocumentState;
  progress: number;
  indexedAt: string | null;
  errorMessage: string | null;
  versionNumber: number;
}

export const documentTypeIcon: Record<string, { icon: IconName; tone: Tone }> = {
  manual: { icon: "book", tone: "default" },
  bulletin: { icon: "alert", tone: "amber" },
  procedure: { icon: "file", tone: "default" },
  policy: { icon: "shield", tone: "default" },
  parts_book: { icon: "layers", tone: "default" },
};
