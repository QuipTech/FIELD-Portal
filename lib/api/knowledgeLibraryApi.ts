import { apiRequest } from "./httpClient";
import type { KnowledgeLibraryFilters, KnowledgeLibraryResults } from "../types/knowledgeLibrary";

// Searchable documents: the organisation's own plus the shared library.
// AI-ranked when available, otherwise keyword (see searchMode).
export const searchKnowledgeLibraryRequest = (accessToken: string, filters: KnowledgeLibraryFilters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value.trim()));
  return apiRequest<KnowledgeLibraryResults>(`/knowledge/library?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
};
