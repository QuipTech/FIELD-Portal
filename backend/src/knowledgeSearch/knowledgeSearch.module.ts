import { Module } from '@nestjs/common';
import { KnowledgeSearchController } from './knowledgeSearch.controller';
import { KnowledgeSearchService } from './knowledgeSearch.service';

@Module({
  controllers: [KnowledgeSearchController],
  providers: [KnowledgeSearchService],
  exports: [KnowledgeSearchService],
})
export class KnowledgeSearchModule {}
