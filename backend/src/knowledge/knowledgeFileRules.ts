// What the shared knowledge library accepts. Kept in one place so the
// DTOs, the service and the frontend's expectations can't drift apart.
// (S3 keys: storage/storageKeys.ts buildSharedDocumentKey.)

export const KNOWLEDGE_DOCUMENT_TYPES = [
  'manual',
  'bulletin',
  'procedure',
  'policy',
  'parts_book',
] as const;
export type KnowledgeDocumentType = (typeof KNOWLEDGE_DOCUMENT_TYPES)[number];

export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Full OEM service manuals run to several hundred MB.
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

// One state for the portal to show, from the item's review status and its
// latest version's ingestion status (see migration 0035 for the mapping).
export type KnowledgeDocumentState =
  | 'uploading'
  | 'queued'
  | 'indexing'
  | 'failed'
  | 'needs_review'
  | 'live'
  | 'archived';

const INDEXING_STATUSES = ['parsing', 'chunking', 'embedding'];

export const deriveDocumentState = (
  itemStatus: string,
  ingestionStatus: string,
): KnowledgeDocumentState => {
  if (itemStatus === 'archived') return 'archived';
  if (ingestionStatus === 'uploading') return 'uploading';
  if (ingestionStatus === 'failed') return 'failed';
  if (INDEXING_STATUSES.includes(ingestionStatus)) return 'indexing';
  if (ingestionStatus !== 'ready') return 'queued';
  return itemStatus === 'review' ? 'needs_review' : 'live';
};
