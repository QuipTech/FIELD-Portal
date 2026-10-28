// SQL shared by the Knowledge catalogue, AI retrieval and AI citations, so a
// passage's section means the same thing everywhere.

// LEFT JOIN LATERAL giving `sec.ordinal` / `sec.heading`: the section a
// chunk (alias `chunkAlias`) belongs to — the one with its heading, else
// the last one starting on or before its page. NULLs when its version has
// no saved sections; pass the result through toSectionId().
export const chunkSectionLateral = (chunkAlias: string): string => `
  LEFT JOIN LATERAL (
    SELECT ds.ordinal, ds.heading FROM document_sections ds
    WHERE ds.document_version_id = ${chunkAlias}.document_version_id
      AND (ds.heading = ${chunkAlias}.section_heading
           OR ds.page_number <= ${chunkAlias}.page_number)
    ORDER BY ds.heading IS NOT DISTINCT FROM ${chunkAlias}.section_heading DESC,
             ds.page_number DESC, ds.ordinal DESC
    LIMIT 1
  ) sec ON true`;
