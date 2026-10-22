import { AlertEngineModule } from '../alertEngine/alertEngine.module';
import { Module } from '@nestjs/common';
import { BedrockModule } from '../bedrock/bedrock.module';
import { KnowledgeSearchModule } from '../knowledgeSearch/knowledgeSearch.module';
import { AiAssistantController } from './aiAssistant.controller';
import { AiAskContextService } from './aiAskContext.service';
import { AiAskService } from './aiAsk.service';
import { AiConversationsService } from './aiConversations.service';
import { AiRetrievalService } from './aiRetrieval.service';
import { AiFeedbackService } from './feedback/aiFeedback.service';
import { AiUsageService } from './usage/aiUsage.service';
import { KnowledgeAccessModule } from '../knowledgeCatalog/access/knowledgeAccess.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    BedrockModule,
    KnowledgeSearchModule,
    AlertEngineModule,
    KnowledgeAccessModule,
    EntitlementsModule,
    BillingModule,
  ],
  controllers: [AiAssistantController],
  providers: [
    AiAskContextService,
    AiAskService,
    AiConversationsService,
    AiRetrievalService,
    AiFeedbackService,
    AiUsageService,
  ],
})
export class AiAssistantModule {}
