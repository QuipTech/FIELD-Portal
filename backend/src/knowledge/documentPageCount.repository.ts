import { DatabaseService } from '../database/database.service';

export interface VersionAwaitingPageCount {
  version_id: string;
  storage_key: string;
  content_type: string;
  // bigint arrives from pg as a string.
  size_bytes: string | null;
}

// Both go through SECURITY DEFINER functions (migration 0034): the job runs
// outside any request, across shared and tenant documents.

export const listVersionsAwaitingPageCount = async (
  databaseService: DatabaseService,
  limit: number,
): Promise<VersionAwaitingPageCount[]> => {
  const result = await databaseService.query<VersionAwaitingPageCount>(
    `SELECT * FROM list_document_versions_missing_page_count($1)`,
    [limit],
  );
  return result.rows;
};

export const recordPageCount = async (
  databaseService: DatabaseService,
  params: {
    versionId: string;
    pageCount: number | null;
    isUnreadable: boolean;
  },
): Promise<void> => {
  await databaseService.query(`SELECT record_document_page_count($1, $2, $3)`, [
    params.versionId,
    params.pageCount,
    params.isUnreadable,
  ]);
};
