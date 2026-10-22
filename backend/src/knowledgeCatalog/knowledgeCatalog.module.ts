import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { KnowledgeAccessModule } from './access/knowledgeAccess.module';
import { AdminKnowledgeReviewController } from './admin/adminKnowledgeReview.controller';
import { AdminKnowledgeTaxonomyController } from './admin/adminKnowledgeTaxonomy.controller';
import { BrandAccessService } from './admin/brandAccess.service';
import { KnowledgeAttentionService } from './admin/knowledgeAttention.service';
import { KnowledgeTaxonomyService } from './admin/knowledgeTaxonomy.service';
import { KnowledgeBrandsController } from './brands/knowledgeBrands.controller';
import { KnowledgeBrandsService } from './brands/knowledgeBrands.service';
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
    KnowledgeBrandsController,
    CatalogDocumentsController,
    MyKnowledgeController,
    MachineManualsController,
    AdminKnowledgeReviewController,
    AdminKnowledgeTaxonomyController,
  ],
  providers: [
    KnowledgeBrandsService,
    CatalogDocumentsService,
    DocumentPagesService,
    CatalogSearchService,
    MyKnowledgeService,
    KnowledgeAttentionService,
    KnowledgeTaxonomyService,
    BrandAccessService,
  ],
})
export class KnowledgeCatalogModule {}
