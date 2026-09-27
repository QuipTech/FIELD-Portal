import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MB = 1024 * 1024;

// Everything the pipeline reads from the environment, in one place.
@Injectable()
export class IndexingConfig {
  // Titan Text Embeddings v2 at 1024 dimensions — matches vector(1024) in
  // document_chunks (migration 0013).
  readonly embeddingModelId: string;
  readonly bedrockRegion: string | undefined;
  readonly isOcrEnabled: boolean;
  readonly isWorkerEnabled: boolean;
  // The whole file is parsed in memory; bigger files fail with a message.
  readonly maxIndexBytes: number;

  constructor(configService: ConfigService) {
    this.embeddingModelId =
      configService.get<string>('BEDROCK_EMBEDDING_MODEL_ID') ||
      'amazon.titan-embed-text-v2:0';
    this.bedrockRegion =
      configService.get<string>('BEDROCK_REGION') ||
      configService.get<string>('AWS_REGION') ||
      undefined;
    this.isOcrEnabled =
      configService.get<string>('TEXTRACT_OCR_ENABLED') === 'true';
    this.isWorkerEnabled =
      configService.get<string>('KNOWLEDGE_INDEXING_ENABLED') !== 'false';
    this.maxIndexBytes =
      Number(configService.get<string>('KNOWLEDGE_INDEXING_MAX_MB') || 200) *
      MB;
  }
}
