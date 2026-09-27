import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentLifecycleController } from './documentLifecycle.controller';
import { DocumentLifecycleService } from './documentLifecycle.service';
import { DocumentVersionsService } from './documentVersions.service';

@Module({
  imports: [KnowledgeModule],
  controllers: [DocumentsController, DocumentLifecycleController],
  providers: [
    DocumentsService,
    DocumentLifecycleService,
    DocumentVersionsService,
  ],
  exports: [DocumentLifecycleService],
})
export class DocumentsModule {}
