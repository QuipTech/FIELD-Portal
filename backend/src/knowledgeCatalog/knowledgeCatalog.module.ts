import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { KnowledgeAccessModule } from './access/knowledgeAccess.module';
import { AdminKnowledgeReviewController } from './admin/adminKnowledgeReview.controller';
import { KnowledgeAttentionService } from './admin/knowledgeAttention.service';
import { CatalogBrandsController } from './brands/catalogBrands.controller';
import { CatalogBrandsService } from './brands/catalogBrands.service';
import { CatalogDocumentsController } from './documents/catalogDocuments.controller';
import { CatalogDocumentsService } from './documents/catalogDocuments.service';
import { MyKnowledgeController } from './myKnowledge/myKnowledge.controller';
import { MachineManualsController } from './myKnowledge/machineManuals.controller';
import { MyKnowledgeService } from './myKnowledge/myKnowledge.service';
import { DocumentPagesService } from './pages/documentPages.service';
import { CatalogSearchService } from './search/catalogSearch.service';

@Module({
  imports: [DocumentsModule, KnowledgeAccessModule],
  controllers: [
    CatalogBrandsController,
    CatalogDocumentsController,
    MyKnowledgeController,
    MachineManualsController,
    AdminKnowledgeReviewController,
  ],
  providers: [
    CatalogBrandsService,
    CatalogDocumentsService,
    DocumentPagesService,
    CatalogSearchService,
    MyKnowledgeService,
    KnowledgeAttentionService,
  ],
})
export class KnowledgeCatalogModule {}
