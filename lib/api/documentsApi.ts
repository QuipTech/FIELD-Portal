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
