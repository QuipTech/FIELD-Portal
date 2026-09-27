import {
  completeKnowledgeUploadRequest,
  createKnowledgeUploadRequest,
  deleteKnowledgeDocumentRequest,
} from "@/lib/api/adminKnowledgeApi";
import { uploadFileToSignedUrl } from "@/lib/api/signedUrlUpload";
import { resolveKnowledgeContentType } from "@/lib/format/knowledgeUploadFile";
import type { KnowledgeDocument, KnowledgeDocumentType } from "@/lib/types/adminDocument";

// The three-step upload: record the document and get a signed S3 URL, PUT
// the file straight to S3, then confirm so the backend queues indexing.
// If the S3 step fails the half-created record is removed again.
export const uploadKnowledgeDocument = async (
  accessToken: string,
  file: File,
  details: { title: string; type: KnowledgeDocumentType },
  onProgress: (fraction: number) => void,
): Promise<KnowledgeDocument> => {
  const ticket = await createKnowledgeUploadRequest(accessToken, {
    ...details,
    fileName: file.name,
    contentType: resolveKnowledgeContentType(file) ?? file.type,
    sizeBytes: file.size,
  });
  try {
    await uploadFileToSignedUrl(ticket.upload, file, onProgress);
  } catch (error) {
    await deleteKnowledgeDocumentRequest(accessToken, ticket.document.id).catch(() => undefined);
    throw error;
  }
  return completeKnowledgeUploadRequest(accessToken, ticket.document.id);
};
