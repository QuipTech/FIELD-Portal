import { apiRequest } from "./httpClient";
import type { KnowledgeArticle } from "../types/knowledgeArticle";

// 404 outside the caller's organisation and the shared library; 409 while
// the document isn't live yet (poll GET /documents/:id/status).
export const getKnowledgeArticleRequest = (accessToken: string, documentId: string) =>
  apiRequest<KnowledgeArticle>(`/documents/${documentId}/article`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
