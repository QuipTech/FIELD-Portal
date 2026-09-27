import type { KnowledgeDocument } from "../types/adminDocument";

// "02 Mar · 09:40"
const formatIndexedAt = (isoDate: string): string => {
  const date = new Date(isoDate);
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
};

// The admin Knowledge page's "Indexed" column.
export const formatDocumentIndexedLabel = (document: Pick<KnowledgeDocument, "state" | "progress" | "indexedAt">): string => {
  switch (document.state) {
    case "uploading":
      return "Uploading…";
    case "queued":
      return "Queued for indexing";
    case "indexing":
      return `Indexing ${document.progress}%`;
    case "failed":
      return "—";
    case "needs_review":
    case "live":
    case "archived":
      return document.indexedAt ? formatIndexedAt(document.indexedAt) : "—";
  }
};
