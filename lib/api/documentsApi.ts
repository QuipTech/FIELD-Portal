import { apiRequest } from "./httpClient";
import { uploadMultipart } from "./multipartUpload";
import type { KnowledgeDocument, KnowledgeDocumentType, SignedUrl } from "../types/adminDocument";
import type { UploadedFile } from "../types/uploadedFile";

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

// PDF/DOC/DOCX up to 20 MB; needs the "Submit knowledge items" permission.
export const uploadDocumentRequest = (
  accessToken: string,
  file: File,
  details: { type: KnowledgeDocumentType; title?: string },
  onProgress?: (fraction: number) => void,
): Promise<{ document: KnowledgeDocument; file: UploadedFile }> =>
  uploadMultipart("/documents", { accessToken, file, fields: details, onProgress });

export const getDocumentDownloadUrlRequest = (accessToken: string, documentId: string): Promise<SignedUrl> =>
  apiRequest<SignedUrl>(`/documents/${documentId}/download`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
