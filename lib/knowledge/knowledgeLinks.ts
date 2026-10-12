import type { KnowledgeLibraryFilters } from "../types/knowledgeLibrary";

// The /knowledge filters an article keeps in its own URL, so its
// breadcrumb (and Back) return to the same results.
const KEPT_FILTERS = { q: "search", type: "type", make: "make", model: "model" } as const;

export type KnowledgeListContext = Partial<Record<keyof typeof KEPT_FILTERS, string>>;

export const toListContext = (filters: Pick<KnowledgeLibraryFilters, "search" | "type" | "make" | "model">): KnowledgeListContext => {
  const context: KnowledgeListContext = {};
  (Object.keys(KEPT_FILTERS) as (keyof typeof KEPT_FILTERS)[]).forEach((param) => {
    const value = filters[KEPT_FILTERS[param]].trim();
    if (value) context[param] = value;
  });
  return context;
};

const toQuery = (params: Record<string, string | undefined>): string => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => value && search.set(key, value));
  const query = search.toString();
  return query ? `?${query}` : "";
};

// /knowledge?q=…&type=…
export const buildKnowledgeListHref = (context: KnowledgeListContext): string => `/knowledge${toQuery(context)}`;

// /knowledge/:id?q=…&section=s3 — section scrolls to and highlights it.
export const buildArticleHref = (documentId: string, context: KnowledgeListContext, section?: string | null): string =>
  `/knowledge/${documentId}${toQuery({ ...context, section: section ?? undefined })}`;

export const readListContext = (params: URLSearchParams): KnowledgeListContext => {
  const context: KnowledgeListContext = {};
  (Object.keys(KEPT_FILTERS) as (keyof typeof KEPT_FILTERS)[]).forEach((param) => {
    const value = params.get(param);
    if (value) context[param] = value;
  });
  return context;
};
