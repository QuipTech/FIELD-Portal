import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { DocumentsModule } from '../documents/documents.module';
import { AdminKnowledgeVersionsService } from './adminKnowledgeVersions.service';
import { AdminKnowledgeController } from './adminKnowledge.controller';
import { AdminKnowledgeService } from './adminKnowledge.service';
import { AdminKnowledgeUploadsService } from './adminKnowledgeUploads.service';

@Module({
  imports: [KnowledgeModule, DocumentsModule],
  controllers: [AdminKnowledgeController],
  providers: [
    AdminKnowledgeService,
    AdminKnowledgeUploadsService,
    AdminKnowledgeVersionsService,
  ],
})
export class AdminKnowledgeModule {}
