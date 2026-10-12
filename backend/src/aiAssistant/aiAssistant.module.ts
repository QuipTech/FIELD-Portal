import { AlertEngineModule } from '../alertEngine/alertEngine.module';
import { Module } from '@nestjs/common';
import { BedrockModule } from '../bedrock/bedrock.module';
import { KnowledgeSearchModule } from '../knowledgeSearch/knowledgeSearch.module';
import { AiAssistantController } from './aiAssistant.controller';
import { AiAskContextService } from './aiAskContext.service';
import { AiAskService } from './aiAsk.service';
import { AiConversationsService } from './aiConversations.service';

@Module({
  imports: [BedrockModule, KnowledgeSearchModule, AlertEngineModule],
  controllers: [AiAssistantController],
  providers: [AiAskContextService, AiAskService, AiConversationsService],
})
export class AiAssistantModule {}
