import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Sonnet 4.5 and Haiku 4.5 are ARN-versioned Bedrock models that must be
// called through a cross-region inference profile. The defaults use the
// Australian (au.) profile to keep inference in-country, matching the
// model_name LIKE 'au.%' / ap-southeast-2 checks in migration 0019. Set
// the env vars to a global./apac. profile if au. isn't enabled on the
// AWS account.
const DEFAULT_ANSWER_MODEL_ID = 'au.anthropic.claude-sonnet-4-5-20250929-v1:0';
const DEFAULT_BACKGROUND_MODEL_ID =
  'au.anthropic.claude-haiku-4-5-20251001-v1:0';
const DEFAULT_REGION = 'ap-southeast-2';

const MODEL_LABELS: [pattern: string, label: string][] = [
  ['claude-sonnet-4-5', 'Claude Sonnet 4.5'],
  ['claude-haiku-4-5', 'Claude Haiku 4.5'],
];

// "au.anthropic.claude-sonnet-4-5-20250929-v1:0" → "Claude Sonnet 4.5";
// unknown ids are shown as-is.
export const toModelLabel = (modelId: string): string =>
  MODEL_LABELS.find(([pattern]) => modelId.includes(pattern))?.[1] ?? modelId;

@Injectable()
export class AiPlatformConfig {
  readonly region: string;
  // Technician-facing answers (and the prompt Test button).
  readonly answerModelId: string;
  // Indexing, summaries and other background work.
  readonly backgroundModelId: string;

  constructor(configService: ConfigService) {
    this.region =
      configService.get<string>('BEDROCK_REGION') ||
      configService.get<string>('AWS_REGION') ||
      DEFAULT_REGION;
    this.answerModelId =
      configService.get<string>('BEDROCK_ANSWER_MODEL_ID') ||
      DEFAULT_ANSWER_MODEL_ID;
    this.backgroundModelId =
      configService.get<string>('BEDROCK_BACKGROUND_MODEL_ID') ||
      DEFAULT_BACKGROUND_MODEL_ID;
  }
}
