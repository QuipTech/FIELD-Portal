// SQL fragments shared by the Knowledge catalogue and AI retrieval, so a
// document's brand and a passage's section mean the same thing everywhere.

// A knowledge item's brand (alias `ki`): the admin-set manufacturer, else
// the maker of the model the document mentions most.
export const ITEM_BRAND_SQL = `COALESCE(ki.manufacturer_id, (
  SELECT mm.manufacturer_id FROM knowledge_item_machine_models km
  JOIN machine_models mm ON mm.id = km.machine_model_id
  WHERE km.knowledge_item_id = ki.id
  ORDER BY km.mention_count DESC, mm.name LIMIT 1))`;

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
