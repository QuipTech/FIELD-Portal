import { apiRequest } from "./httpClient";
import type {
  CreateKnowledgeUploadPayload,
  KnowledgeDocument,
  KnowledgeDocumentList,
  KnowledgeDocumentType,
  KnowledgeUploadTicket,
  SignedUrl,
} from "../types/adminDocument";

// The shared knowledge library (every organisation reads it). Owner only.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const listKnowledgeDocumentsRequest = (
  accessToken: string,
  query: { search?: string; type?: KnowledgeDocumentType; pageSize?: number } = {},
): Promise<KnowledgeDocumentList> => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => value !== undefined && params.set(key, String(value)));
  const queryString = params.toString();
  return apiRequest<KnowledgeDocumentList>(`/admin/knowledge/documents${queryString ? `?${queryString}` : ""}`, {
    headers: authorizationHeader(accessToken),
  });
};

// Step 1 of an upload: records the document and returns a signed S3 URL.
export const createKnowledgeUploadRequest = (
  accessToken: string,
  payload: CreateKnowledgeUploadPayload,
): Promise<KnowledgeUploadTicket> =>
  apiRequest<KnowledgeUploadTicket>("/admin/knowledge/uploads", {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(payload),
  });

// Step 3 (after the browser PUTs the file to S3): queues it for indexing.
export const completeKnowledgeUploadRequest = (accessToken: string, documentId: string): Promise<KnowledgeDocument> =>
  apiRequest<KnowledgeDocument>(`/admin/knowledge/documents/${documentId}/upload-complete`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
  });

export const getKnowledgeDownloadUrlRequest = (accessToken: string, documentId: string): Promise<SignedUrl> =>
  apiRequest<SignedUrl>(`/admin/knowledge/documents/${documentId}/download`, {
    headers: authorizationHeader(accessToken),
  });

export const deleteKnowledgeDocumentRequest = (accessToken: string, documentId: string): Promise<void> =>
  apiRequest<void>(`/admin/knowledge/documents/${documentId}`, {
    method: "DELETE",
    headers: authorizationHeader(accessToken),
  });
