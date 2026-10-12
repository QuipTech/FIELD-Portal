import { DatabaseService } from '../database/database.service';
import { AiPlatformUsageEntry } from './types/aiPlatformUsageEntry';

// Through a SECURITY DEFINER function (migration 0063): the indexing
// worker has no tenant context and shared documents have no tenant.
export const insertPlatformUsage = async (
  databaseService: DatabaseService,
  entry: AiPlatformUsageEntry & { costEstimate: number },
): Promise<void> => {
  await databaseService.query(
    `SELECT record_ai_platform_usage($1, $2, $3, $4, $5, $6)`,
    [
      entry.tenantId,
      entry.source,
      entry.modelId,
      entry.inputTokens,
      entry.outputTokens,
      entry.costEstimate,
    ],
  );
};
