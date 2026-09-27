// Mirrors the backend's upload rules (adminKnowledge/knowledgeFileRules.ts)
// so bad files are caught before any request is made.
const contentTypesByExtension: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const ACCEPTED_KNOWLEDGE_FILES = ".pdf,.doc,.docx";
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

const extensionOf = (fileName: string) => fileName.split(".").pop()?.toLowerCase() ?? "";

// Browsers leave File.type empty for some Word files, so fall back to the
// extension. Null means the file type isn't accepted.
export const resolveKnowledgeContentType = (file: File): string | null => {
  const byExtension = contentTypesByExtension[extensionOf(file.name)];
  if (!byExtension) return null;
  return Object.values(contentTypesByExtension).includes(file.type) ? file.type : byExtension;
};

export const findKnowledgeFileProblem = (file: File): string | null => {
  if (!resolveKnowledgeContentType(file)) return "Only PDF and Word documents can be uploaded.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "Files can be at most 500 MB.";
  return null;
};

// "CAT_793F-service manual.pdf" → "CAT 793F service manual"
export const titleFromFileName = (fileName: string): string =>
  fileName.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim() || fileName;
