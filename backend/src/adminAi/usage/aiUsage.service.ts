import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AiPlatformConfig, toModelLabel } from '../aiPlatformConfig';
import * as aiUsageRepository from './aiUsage.repository';
import { toUsageOverview } from './aiUsageRules';
import { AiPlatformInfo, AiUsageOverview } from '../types/adminAiResponse';

const TOP_ORGANISATIONS_LIMIT = 5;

// Figures span every organisation on the platform.
@Injectable()
export class AiUsageService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly aiPlatformConfig: AiPlatformConfig,
  ) {}

  getUsageOverview = async (days: number): Promise<AiUsageOverview> => {
    const [summary, perDay, byOrganisation] = await Promise.all([
      aiUsageRepository.getUsageSummary(this.databaseService, days),
      aiUsageRepository.listQueriesPerDay(this.databaseService, days),
      aiUsageRepository.listUsageByOrganisation(this.databaseService, {
        days,
        limit: TOP_ORGANISATIONS_LIMIT,
      }),
    ]);
    return toUsageOverview(days, summary, perDay, byOrganisation);
  };

  getPlatformInfo = (): AiPlatformInfo => {
    const { answerModelId, backgroundModelId, region } = this.aiPlatformConfig;
    return {
      provider: 'Amazon Bedrock',
      region,
      isLocked: true,
      models: [
        {
          role: 'answers',
          label: toModelLabel(answerModelId),
          modelId: answerModelId,
          purpose: 'technician queries',
        },
        {
          role: 'background',
          label: toModelLabel(backgroundModelId),
          modelId: backgroundModelId,
          purpose: 'indexing, summaries',
        },
      ],
    };
  };
}
