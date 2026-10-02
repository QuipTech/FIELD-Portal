import { Injectable, Logger } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { BedrockConfig } from './bedrockConfig';
import { buildTechnicalRequestBody } from './buildTechnicalRequestBody';
import { readBedrockStream } from './readBedrockStream';
import {
  BEDROCK_SETUP_ERRORS,
  bedrockErrorName,
  retryBedrockCall,
} from './retryBedrockCall';
import { selectModelTier } from './selectModelTier';
import { toAssistantHttpError } from './toAssistantHttpError';
import {
  ModelTier,
  TechnicalQuestion,
  TechnicalResponse,
  TechnicalResponseOptions,
} from './types/technicalResponse';

// Claude on Amazon Bedrock for technician answers. Credentials come from
// the default AWS provider chain (env, profile or instance role), like
// the embedder and Textract clients.
@Injectable()
export class BedrockService {
  private readonly logger = new Logger(BedrockService.name);
  private readonly client: BedrockRuntimeClient;

  constructor(private readonly bedrockConfig: BedrockConfig) {
    this.client = new BedrockRuntimeClient({ region: bedrockConfig.region });
  }

  // Streams an answer grounded in the retrieved chunks. Throttling and
  // transient errors are retried until the first text reaches the
  // caller; after that a retry would repeat text they already have. If
  // the light model isn't usable (e.g. not enabled on the account), the
  // question goes to the primary model instead of failing. Failures are
  // rethrown as HttpExceptions with a safe message.
  generateTechnicalResponse = async (
    question: TechnicalQuestion,
    options: TechnicalResponseOptions,
  ): Promise<TechnicalResponse> => {
    const tier = selectModelTier(question, this.bedrockConfig.lightRouting);
    const state = { hasSentText: false };
    try {
      return await this.streamFromModel(tier, question, options, state);
    } catch (error) {
      this.logFailure(tier, question, error);
      const canFallBack =
        tier === 'light' &&
        !state.hasSentText &&
        BEDROCK_SETUP_ERRORS.includes(bedrockErrorName(error));
      if (!canFallBack) throw toAssistantHttpError(error);
    }
    try {
      return await this.streamFromModel('primary', question, options, state);
    } catch (error) {
      this.logFailure('primary', question, error);
      throw toAssistantHttpError(error);
    }
  };

  private streamFromModel = async (
    tier: ModelTier,
    question: TechnicalQuestion,
    options: TechnicalResponseOptions,
    state: { hasSentText: boolean },
  ): Promise<TechnicalResponse> => {
    const modelId = this.modelIdFor(tier);
    const command = new InvokeModelWithResponseStreamCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: buildTechnicalRequestBody(
        question,
        this.bedrockConfig.maxOutputTokens,
      ),
    });
    const onText = (text: string) => {
      state.hasSentText = true;
      options.onText(text);
    };
    const answer = await retryBedrockCall(
      async () => {
        const response = await this.client.send(command, {
          abortSignal: options.signal,
        });
        if (!response.body) throw new Error('Bedrock returned no stream.');
        return readBedrockStream(response.body, onText);
      },
      { canRetry: () => !state.hasSentText && !options.signal?.aborted },
    );
    return { modelId, tier, ...answer };
  };

  private modelIdFor = (tier: ModelTier): string =>
    tier === 'light'
      ? this.bedrockConfig.lightModelId
      : this.bedrockConfig.primaryModelId;

  private logFailure = (
    tier: ModelTier,
    question: TechnicalQuestion,
    error: unknown,
  ) =>
    this.logger.warn(
      `Answer on ${this.modelIdFor(tier)} for tenant ${question.tenantId} failed: ${bedrockErrorName(error) || 'Error'} ${String(error)}`,
    );
}
