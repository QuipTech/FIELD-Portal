// How a machine document is shown in the portal. "none" is an old .doc file:
// nothing in the browser can read that format, so it's offered as a download.
export type DocumentViewKind = "pdf" | "image" | "heic" | "docx" | "none";

const KINDS_BY_CONTENT_TYPE: Record<string, DocumentViewKind> = {
  "application/pdf": "pdf",
  "image/jpeg": "image",
  "image/png": "image",
  "image/heic": "heic",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export const toDocumentViewKind = (contentType: string): DocumentViewKind => KINDS_BY_CONTENT_TYPE[contentType] ?? "none";
