import { DatabaseService } from '../database/database.service';

export interface MatchingSectionRow {
  document_version_id: string;
  ordinal: number;
  heading: string | null;
  page_number: number | null;
}

// For each result, the section of its live version that best matches the
// search words (any word counts, like the keyword search), nearest the
// matched chunk's page on a tie. Versions with no saved sections (indexed
// before migration 0076, never opened since) have no row.
export const findMatchingSections = async (
  databaseService: DatabaseService,
  params: {
    tenantId: string;
    search: string;
    matches: { versionId: string; chunkPage: number | null }[];
  },
): Promise<MatchingSectionRow[]> => {
  if (!params.matches.length) return [];
  const result = await databaseService.withTenant(params.tenantId, (client) =>
    client.query<MatchingSectionRow>(
      `WITH q AS (
         SELECT replace(plainto_tsquery('english', $3)::text, '&', '|')::tsquery AS query
       )
       SELECT DISTINCT ON (s.document_version_id)
              s.document_version_id, s.ordinal, s.heading, s.page_number
       FROM document_sections s
       JOIN unnest($1::uuid[], $2::int[]) AS r(version_id, chunk_page)
         ON r.version_id = s.document_version_id
       CROSS JOIN q
       WHERE s.tenant_id IS NULL OR s.tenant_id = $4
       ORDER BY s.document_version_id,
                ts_rank(to_tsvector('english', coalesce(s.heading, '') || ' ' || s.content), q.query) DESC,
                abs(coalesce(s.page_number, 0) - coalesce(r.chunk_page, 0)),
                s.ordinal`,
      [
        params.matches.map((match) => match.versionId),
        params.matches.map((match) => match.chunkPage),
        params.search,
        params.tenantId,
      ],
    ),
  );
  return result.rows;
};
