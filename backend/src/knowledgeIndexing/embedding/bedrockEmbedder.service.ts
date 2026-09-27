import { Injectable } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { IndexingConfig } from '../indexingConfig';

const EMBEDDING_DIMENSIONS = 1024;
// Titan v2 accepts up to 8k tokens (~50k characters) per request.
const MAX_INPUT_CHARS = 30000;
const MAX_ATTEMPTS = 5;
const RETRYABLE_ERRORS = [
  'ThrottlingException',
  'ServiceUnavailableException',
  'ModelNotReadyException',
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Text → 1024-dimension vector with Amazon Bedrock (Titan Text Embeddings
// v2 by default). Normalised, so cosine distance works in pgvector.
@Injectable()
export class BedrockEmbedderService {
  private readonly client: BedrockRuntimeClient;

  constructor(private readonly indexingConfig: IndexingConfig) {
    this.client = new BedrockRuntimeClient({
      region: indexingConfig.bedrockRegion,
    });
  }

  embed = async (text: string): Promise<number[]> => {
    const command = new InvokeModelCommand({
      modelId: this.indexingConfig.embeddingModelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inputText: text.slice(0, MAX_INPUT_CHARS),
        dimensions: EMBEDDING_DIMENSIONS,
        normalize: true,
      }),
    });
    for (let attempt = 1; ; attempt += 1) {
      try {
        const response = await this.client.send(command);
        return (
          JSON.parse(new TextDecoder().decode(response.body)) as {
            embedding: number[];
          }
        ).embedding;
      } catch (error) {
        const name = (error as { name?: string }).name ?? '';
        if (attempt >= MAX_ATTEMPTS || !RETRYABLE_ERRORS.includes(name))
          throw error;
        await wait(500 * 2 ** attempt);
      }
    }
  };
}

// pgvector's text form: '[0.1,0.2,…]'.
export const toVectorLiteral = (embedding: number[]): string =>
  `[${embedding.join(',')}]`;
