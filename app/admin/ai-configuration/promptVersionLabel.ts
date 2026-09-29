import { formatShortDate } from "@/lib/format/shortDate";
import type { PromptVersionSummary } from "@/lib/types/aiConfiguration";

// "v3 — published 17 Mar by A. Kaur", or "v4 — saved 18 Mar by …" for a
// version that was never published.
export const describePromptVersion = (version: PromptVersionSummary): string => {
  const isPublished = Boolean(version.publishedAt);
  const verb = isPublished ? "published" : "saved";
  const date = formatShortDate(version.publishedAt ?? version.createdAt);
  const author = isPublished ? version.publishedByName : version.createdByName;
  return `v${version.versionNumber} — ${verb} ${date}${author ? ` by ${author}` : ""}`;
};
