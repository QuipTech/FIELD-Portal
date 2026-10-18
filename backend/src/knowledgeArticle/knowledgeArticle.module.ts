import { Module } from '@nestjs/common';
import { KnowledgeArticleController } from './knowledgeArticle.controller';
import { KnowledgeArticleService } from './knowledgeArticle.service';

@Module({
  controllers: [KnowledgeArticleController],
  exports: [KnowledgeArticleService],
  providers: [KnowledgeArticleService],
})
export class KnowledgeArticleModule {}
