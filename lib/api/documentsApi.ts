import { apiRequest } from "./httpClient";
import type { KnowledgeDocument, SignedUrl } from "../types/adminDocument";

// The caller's organisation documents plus the shared QuipTech library.
export type OrganisationDocument = KnowledgeDocument & { downloadUrl: string | null };

export interface OrganisationDocumentList {
  documents: OrganisationDocument[];
  total: number;
}

export const listDocumentsRequest = (accessToken: string): Promise<OrganisationDocumentList> =>
  apiRequest<OrganisationDocumentList>("/documents?pageSize=100", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

export const getDocumentDownloadUrlRequest = (accessToken: string, documentId: string): Promise<SignedUrl> =>
  apiRequest<SignedUrl>(`/documents/${documentId}/download`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

// Permanent: every version, its chunks and stored files. Shared-library
// documents need platform.manage; an organisation's own need knowledge.submit.
export const deleteDocumentRequest = (accessToken: string, documentId: string): Promise<void> =>
  apiRequest<void>(`/documents/${documentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
