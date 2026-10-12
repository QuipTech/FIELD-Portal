import {
  completeKnowledgeUploadRequest,
  createKnowledgeUploadRequest,
  deleteKnowledgeDocumentRequest,
} from "@/lib/api/adminKnowledgeApi";
import { createVersionUploadRequest } from "@/lib/api/documentLifecycleApi";
import { uploadFileToSignedUrl } from "@/lib/api/signedUrlUpload";
import { resolveKnowledgeContentType } from "@/lib/format/knowledgeUploadFile";
import type { KnowledgeDocument, KnowledgeDocumentType, KnowledgeUploadTicket } from "@/lib/types/adminDocument";

const describeFile = (file: File) => ({
  fileName: file.name,
  contentType: resolveKnowledgeContentType(file) ?? file.type,
  sizeBytes: file.size,
});

// PUT straight to S3 with the ticket's signed URL, then confirm so the
// backend checks the file and queues it for indexing.
const putAndComplete = async (
  accessToken: string,
  ticket: KnowledgeUploadTicket,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<KnowledgeDocument> => {
  await uploadFileToSignedUrl(ticket.upload, file, onProgress);
  return completeKnowledgeUploadRequest(accessToken, ticket.document.id);
};

// A new shared-library document. If the S3 step fails the half-created
// record is removed again.
export const uploadKnowledgeDocument = async (
  accessToken: string,
  file: File,
  details: { title: string; type: KnowledgeDocumentType },
  onProgress: (fraction: number) => void,
): Promise<KnowledgeDocument> => {
  const ticket = await createKnowledgeUploadRequest(accessToken, { ...details, ...describeFile(file) });
  try {
    return await putAndComplete(accessToken, ticket, file, onProgress);
  } catch (error) {
    await deleteKnowledgeDocumentRequest(accessToken, ticket.document.id).catch(() => undefined);
    throw error;
  }
};

// A new version of an existing shared-library document (up to 500 MB).
// The previous version stays live until this one goes live; an upload that
// fails here is simply superseded by the next attempt.
export const uploadKnowledgeVersion = async (
  accessToken: string,
  documentId: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<KnowledgeDocument> => {
  const ticket = await createVersionUploadRequest(accessToken, documentId, describeFile(file));
  return putAndComplete(accessToken, ticket, file, onProgress);
};
