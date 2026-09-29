import { apiRequest } from "./httpClient";
import type { DocumentStatus, KnowledgeDocument, KnowledgeUploadTicket } from "../types/adminDocument";

// Indexing status and lifecycle actions for one document. Shared-library
// changes and reviews are admin (Owner) only; the backend enforces it.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

const postAction = (accessToken: string, documentId: string, action: string, body?: object) =>
  apiRequest<KnowledgeDocument>(`/documents/${documentId}/${action}`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: body ? JSON.stringify(body) : undefined,
  });

export const getDocumentStatusRequest = (accessToken: string, documentId: string): Promise<DocumentStatus> =>
  apiRequest<DocumentStatus>(`/documents/${documentId}/status`, { headers: authorizationHeader(accessToken) });

// needs_review → live
export const approveDocumentRequest = (accessToken: string, documentId: string) =>
  postAction(accessToken, documentId, "approve");

// needs_review → archived
export const rejectDocumentRequest = (accessToken: string, documentId: string, reason: string) =>
  postAction(accessToken, documentId, "reject", { reason });

// failed → queued
export const retryDocumentRequest = (accessToken: string, documentId: string) =>
  postAction(accessToken, documentId, "retry");

// live → archived (drops out of AI search)
export const archiveDocumentRequest = (accessToken: string, documentId: string) =>
  postAction(accessToken, documentId, "archive");

// Permanent: every version, its chunks and stored files.
export const deleteDocumentRequest = (accessToken: string, documentId: string): Promise<void> =>
  apiRequest<void>(`/documents/${documentId}`, { method: "DELETE", headers: authorizationHeader(accessToken) });

// Shared library, large files: step 1 of a new version (then PUT to S3 and
// POST /admin/knowledge/documents/:id/upload-complete).
export const createVersionUploadRequest = (
  accessToken: string,
  documentId: string,
  file: { fileName: string; contentType: string; sizeBytes: number },
): Promise<KnowledgeUploadTicket> =>
  apiRequest<KnowledgeUploadTicket>(`/admin/knowledge/documents/${documentId}/versions`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(file),
  });
