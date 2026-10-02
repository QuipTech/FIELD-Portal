import { Injectable } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { IndexingConfig } from '../indexingConfig';
import { retryBedrockCall } from '../../bedrock/retryBedrockCall';
import { AiPlatformUsageService } from '../../aiPlatformUsage/aiPlatformUsage.service';

const EMBEDDING_DIMENSIONS = 1024;
// Titan v2 accepts up to 8k tokens (~50k characters) per request.
const MAX_INPUT_CHARS = 30000;

export interface TextEmbedding {
  embedding: number[];
  modelId: string;
  inputTokens: number;
}

// Text → 1024-dimension vector with Amazon Bedrock (Titan Text Embeddings
// v2 by default). Normalised, so cosine distance works in pgvector.
@Injectable()
export class BedrockEmbedderService {
  private readonly client: BedrockRuntimeClient;

  constructor(
    private readonly indexingConfig: IndexingConfig,
    private readonly aiPlatformUsage: AiPlatformUsageService,
  ) {
    this.client = new BedrockRuntimeClient({
      region: indexingConfig.bedrockRegion,
    });
  }

  embed = async (text: string): Promise<TextEmbedding> => {
    const modelId = this.indexingConfig.embeddingModelId;
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inputText: text.slice(0, MAX_INPUT_CHARS),
        dimensions: EMBEDDING_DIMENSIONS,
        normalize: true,
      }),
    });
    const response = await retryBedrockCall(() => this.client.send(command));
    const body = JSON.parse(new TextDecoder().decode(response.body)) as {
      embedding: number[];
      inputTextTokenCount?: number;
    };
    return {
      embedding: body.embedding,
      modelId,
      inputTokens: body.inputTextTokenCount ?? 0,
    };
  };

  // A search box or assistant question, recorded as that organisation's
  // search usage. Callers handle failures (they differ per screen).
  embedSearchQuery = async (
    query: string,
    tenantId: string,
  ): Promise<number[]> => {
    const { embedding, modelId, inputTokens } = await this.embed(query);
    void this.aiPlatformUsage.recordUsage({
      tenantId,
      source: 'search',
      modelId,
      inputTokens,
      outputTokens: 0,
    });
    return embedding;
  };
}

// pgvector's text form: '[0.1,0.2,…]'.
export const toVectorLiteral = (embedding: number[]): string =>
  `[${embedding.join(',')}]`;
