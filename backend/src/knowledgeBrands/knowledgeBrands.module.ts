import { KnowledgeBrandLogoController } from './knowledgeBrandLogo.controller';
import { KnowledgeBrandLogoService } from './knowledgeBrandLogo.service';
import { KnowledgeLibraryModule } from '../knowledgeLibrary/knowledgeLibrary.module';
import { KnowledgeArticleModule } from '../knowledgeArticle/knowledgeArticle.module';
import { KnowledgeBrowseController } from './knowledgeBrowse.controller';
import { Global, Module } from '@nestjs/common';
import { KnowledgeBrandsService } from './knowledgeBrands.service';
import { AdminKnowledgeBrandsController } from './adminKnowledgeBrands.controller';
import { KnowledgeMetadataService } from '../knowledge/knowledgeMetadata.service';
import { AdminKnowledgeMetadataController } from './adminKnowledgeMetadata.controller';

@Global()
@Module({
  imports: [KnowledgeLibraryModule, KnowledgeArticleModule],
  controllers: [
    KnowledgeBrandLogoController,
    KnowledgeBrowseController,
    AdminKnowledgeBrandsController,
    AdminKnowledgeMetadataController,
  ],
  providers: [
    KnowledgeBrandLogoService,
    KnowledgeBrandsService,
    KnowledgeMetadataService,
  ],
  exports: [KnowledgeBrandsService, KnowledgeMetadataService],
})
export class KnowledgeBrandsModule {}
