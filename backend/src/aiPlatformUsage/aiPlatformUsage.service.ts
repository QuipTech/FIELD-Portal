import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { estimateBedrockCost } from '../bedrock/estimateBedrockCost';
import * as aiPlatformUsageRepository from './aiPlatformUsage.repository';
import { AiPlatformUsageEntry } from './types/aiPlatformUsageEntry';

// Records Bedrock calls that aren't a technician's answer (those go to
// ai_usage_log with their message). Never throws: a missed usage row
// must not fail the search, test or indexing job that made the call.
@Injectable()
export class AiPlatformUsageService {
  private readonly logger = new Logger(AiPlatformUsageService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  recordUsage = async (entry: AiPlatformUsageEntry): Promise<void> => {
    if (entry.inputTokens + entry.outputTokens === 0) return;
    try {
      await aiPlatformUsageRepository.insertPlatformUsage(
        this.databaseService,
        {
          ...entry,
          costEstimate: estimateBedrockCost(
            entry.modelId,
            entry.inputTokens,
            entry.outputTokens,
          ),
        },
      );
    } catch (error) {
      this.logger.warn(
        `Couldn't record ${entry.source} usage on ${entry.modelId}: ${String(error)}`,
      );
    }
  };
}
