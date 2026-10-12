import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_ANSWER_MODEL_ID,
  DEFAULT_BACKGROUND_MODEL_ID,
  DEFAULT_REGION,
} from '../adminAi/aiPlatformConfig';

// When a question is simple enough for the light model (Haiku). Every
// limit must hold; a photo always goes to the primary model (Sonnet).
export interface LightRoutingThresholds {
  isEnabled: boolean;
  maxQuestionChars: number;
  // Total characters of retrieved excerpts.
  maxContextChars: number;
  // Earlier messages in the thread.
  maxHistoryMessages: number;
}

const readNumber = (
  configService: ConfigService,
  name: string,
  fallback: number,
): number => {
  const value = Number(configService.get<string>(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

// Everything the Bedrock module reads from the environment. Model ids
// share their defaults with the admin console's AiPlatformConfig.
@Injectable()
export class BedrockConfig {
  readonly region: string;
  // Claude Sonnet 4.5: technician answers by default.
  readonly primaryModelId: string;
  // Claude Haiku 4.5: short lookup-style questions.
  readonly lightModelId: string;
  // Answers are meant to be short (read on a phone mid-task); this is a
  // cost ceiling, not a target.
  readonly maxOutputTokens: number;
  readonly lightRouting: LightRoutingThresholds;

  constructor(configService: ConfigService) {
    this.region =
      configService.get<string>('BEDROCK_REGION') ||
      configService.get<string>('AWS_REGION') ||
      DEFAULT_REGION;
    this.primaryModelId =
      configService.get<string>('BEDROCK_ANSWER_MODEL_ID') ||
      DEFAULT_ANSWER_MODEL_ID;
    this.lightModelId =
      configService.get<string>('BEDROCK_LIGHT_MODEL_ID') ||
      configService.get<string>('BEDROCK_BACKGROUND_MODEL_ID') ||
      DEFAULT_BACKGROUND_MODEL_ID;
    this.maxOutputTokens = readNumber(
      configService,
      'BEDROCK_ANSWER_MAX_TOKENS',
      4096,
    );
    this.lightRouting = {
      isEnabled:
        configService.get<string>('BEDROCK_LIGHT_ROUTING_ENABLED') !== 'false',
      maxQuestionChars: readNumber(
        configService,
        'BEDROCK_LIGHT_MAX_QUESTION_CHARS',
        200,
      ),
      maxContextChars: readNumber(
        configService,
        'BEDROCK_LIGHT_MAX_CONTEXT_CHARS',
        4000,
      ),
      maxHistoryMessages: readNumber(
        configService,
        'BEDROCK_LIGHT_MAX_HISTORY_MESSAGES',
        4,
      ),
    };
  }
}
