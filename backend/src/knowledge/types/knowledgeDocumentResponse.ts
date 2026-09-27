import { KnowledgeDocumentState } from '../knowledgeFileRules';
import { SignedUrl } from '../../storage/types/storedFile';

export interface KnowledgeDocument {
  id: string;
  // True for the QuipTech library every organisation shares.
  isShared: boolean;
  title: string;
  // 'manual' | 'bulletin' | 'procedure' (older items may hold other types).
  type: string;
  // Review status: 'draft' | 'review' | 'approved' | 'published' | …
  status: string;
  state: KnowledgeDocumentState;
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
  // True while the background job hasn't counted pages yet; poll until false.
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

// PUT the file to `upload.url` with exactly `upload.headers`, then call
// the upload-complete endpoint.
export interface KnowledgeUploadTicket {
  document: KnowledgeDocument;
  upload: SignedUrl & { method: 'PUT'; headers: Record<string, string> };
}
