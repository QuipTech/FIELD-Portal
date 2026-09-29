import { Injectable, Logger } from '@nestjs/common';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { AiPlatformConfig } from '../aiPlatformConfig';
import { TestPromptDto } from '../dto/testPromptDto';
import { PromptTestResult } from '../types/adminAiResponse';
import { toBedrockHttpError } from './toBedrockHttpError';

// Non-streaming, so keep responses well under the SDK's HTTP timeout.
const TEST_MAX_TOKENS = 16000;
const REFUSAL_MESSAGE = 'Claude declined to answer this question.';

// The prompt editor's Test button: runs a draft prompt (saved or not)
// against one sample question on the same model technicians get. Nothing
// is stored and no usage is logged against a tenant.
@Injectable()
export class AiPromptTestService {
  private readonly logger = new Logger(AiPromptTestService.name);
  private client: AnthropicBedrock | null = null;

  constructor(private readonly aiPlatformConfig: AiPlatformConfig) {}

  testPrompt = async (dto: TestPromptDto): Promise<PromptTestResult> => {
    const modelId = this.aiPlatformConfig.answerModelId;
    const startedAt = Date.now();
    try {
      const response = await this.getClient().messages.create({
        model: modelId,
        max_tokens: TEST_MAX_TOKENS,
        system: dto.body,
        messages: [{ role: 'user', content: dto.question }],
      });
      const answer = response.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');
      return {
        answer:
          response.stop_reason === 'refusal' && !answer
            ? REFUSAL_MESSAGE
            : answer,
        modelId,
        stopReason: response.stop_reason,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      this.logger.warn(`Prompt test on ${modelId} failed: ${String(error)}`);
      throw toBedrockHttpError(error, modelId) ?? error;
    }
  };

  // Credentials come from the default AWS provider chain (env, profile,
  // or the instance role), the same as the embedder's Bedrock client.
  private getClient = (): AnthropicBedrock => {
    this.client ??= new AnthropicBedrock({
      awsRegion: this.aiPlatformConfig.region,
    });
    return this.client;
  };
}
