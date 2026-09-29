import { Module } from '@nestjs/common';
import { AdminAiUsageController } from './adminAiUsage.controller';
import { AdminAiPromptsController } from './adminAiPrompts.controller';
import { AdminAiReviewQueueController } from './adminAiReviewQueue.controller';
import { AiPlatformConfig } from './aiPlatformConfig';
import { AiUsageService } from './usage/aiUsage.service';
import { AiPromptsService } from './prompts/aiPrompts.service';
import { AiPromptTestService } from './prompts/aiPromptTest.service';
import { AiReviewQueueService } from './reviewQueue/aiReviewQueue.service';

@Module({
  controllers: [
    AdminAiUsageController,
    AdminAiPromptsController,
    AdminAiReviewQueueController,
  ],
  providers: [
    AiPlatformConfig,
    AiUsageService,
    AiPromptsService,
    AiPromptTestService,
    AiReviewQueueService,
  ],
})
export class AdminAiModule {}
