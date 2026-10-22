import { Module } from '@nestjs/common';
import { KnowledgeAccessModule } from '../knowledgeCatalog/access/knowledgeAccess.module';
import { KnowledgeSearchController } from './knowledgeSearch.controller';
import { KnowledgeSearchService } from './knowledgeSearch.service';

@Module({
  imports: [KnowledgeAccessModule],
  controllers: [KnowledgeSearchController],
  providers: [KnowledgeSearchService],
  exports: [KnowledgeSearchService],
})
export class KnowledgeSearchModule {}
