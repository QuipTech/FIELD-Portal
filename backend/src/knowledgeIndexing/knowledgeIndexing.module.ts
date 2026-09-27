import { Global, Module } from '@nestjs/common';
import { IndexingConfig } from './indexingConfig';
import { IndexingWorkerService } from './indexingWorker.service';
import { IndexingPipelineService } from './indexingPipeline.service';
import { TextractOcrService } from './extraction/textractOcr.service';
import { BedrockEmbedderService } from './embedding/bedrockEmbedder.service';

// Global so upload paths can wake the worker (requestRun) and knowledge
// search can reuse the embedder without import chains.
@Global()
@Module({
  providers: [
    IndexingConfig,
    IndexingWorkerService,
    IndexingPipelineService,
    TextractOcrService,
    BedrockEmbedderService,
  ],
  exports: [IndexingWorkerService, BedrockEmbedderService],
})
export class KnowledgeIndexingModule {}
