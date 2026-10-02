import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AdminScope } from '../../auth/adminScope/adminScope';
import { AiPlatformConfig, toModelLabel } from '../aiPlatformConfig';
import * as aiUsageRepository from './aiUsage.repository';
import { toUsageOverview } from './aiUsageRules';
import { AiPlatformInfo, AiUsageOverview } from '../types/adminAiResponse';

const TOP_ORGANISATIONS_LIMIT = 5;

// Figures for the caller's organisation, or every organisation for the
// Owner (AdminScope).
@Injectable()
export class AiUsageService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly aiPlatformConfig: AiPlatformConfig,
  ) {}

  getUsageOverview = async (
    scope: AdminScope,
    days: number,
  ): Promise<AiUsageOverview> => {
    const [summary, perDay, byOrganisation, platformUsage] = await Promise.all([
      aiUsageRepository.getUsageSummary(this.databaseService, scope, days),
      aiUsageRepository.listQueriesPerDay(this.databaseService, scope, days),
      aiUsageRepository.listUsageByOrganisation(this.databaseService, scope, {
        days,
        limit: TOP_ORGANISATIONS_LIMIT,
      }),
      aiUsageRepository.listPlatformUsage(this.databaseService, scope, days),
    ]);
    return toUsageOverview(days, {
      summary,
      perDay,
      byOrganisation,
      platformUsage,
    });
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
