import { TECHNICAL_ASSISTANT_PROMPT } from './technicalAssistantPrompt';
import {
  ConversationTurn,
  RetrievedChunk,
  TechnicalQuestion,
} from './types/technicalResponse';

// Bedrock's Messages API version for Anthropic models.
const BEDROCK_ANTHROPIC_VERSION = 'bedrock-2023-05-31';

const NO_SOURCES_NOTICE =
  'No approved sources matched this question. Say so and suggest escalating to a remote expert.';

type ContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: string; data: string };
    };

interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

// "[2] Service manual — p. 214 · Brake accumulator"
const describeChunk = (chunk: RetrievedChunk, index: number): string => {
  const location = [
    chunk.page !== null ? `p. ${chunk.page}` : null,
    chunk.heading,
  ].filter(Boolean);
  const suffix = location.length ? ` — ${location.join(' · ')}` : '';
  return `[${index + 1}] ${chunk.title}${suffix}\n${chunk.text}`;
};

const formatSources = (chunks: RetrievedChunk[]): string =>
  chunks.length
    ? `<sources>\n${chunks.map(describeChunk).join('\n\n')}\n</sources>\n\nCite sources inline by their number, e.g. [1], naming the document and page or section.`
    : `<sources>\n${NO_SOURCES_NOTICE}\n</sources>`;

export const buildQuestionText = (question: TechnicalQuestion): string =>
  [
    question.machineContext
      ? `<machine>\n${question.machineContext}\n</machine>`
      : null,
    formatSources(question.chunks ?? []),
    `<question>\n${question.question}\n</question>`,
  ]
    .filter(Boolean)
    .join('\n\n');

// The Messages API needs the first turn to be the user's; a thread that
// somehow starts with an answer drops that answer.
const toHistoryMessages = (history: ConversationTurn[]): BedrockMessage[] => {
  const firstUserIndex = history.findIndex((turn) => turn.role === 'user');
  if (firstUserIndex === -1) return [];
  return history
    .slice(firstUserIndex)
    .map((turn) => ({ role: turn.role, content: turn.content }));
};

// The image block goes before the text so Claude reads the photo first.
const toQuestionContent = (question: TechnicalQuestion): ContentBlock[] => {
  const text: ContentBlock = {
    type: 'text',
    text: buildQuestionText(question),
  };
  if (!question.image) return [text];
  return [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: question.image.mediaType,
        data: question.image.data,
      },
    },
    text,
  ];
};

export const buildTechnicalRequestBody = (
  question: TechnicalQuestion,
  maxTokens: number,
): string =>
  JSON.stringify({
    anthropic_version: BEDROCK_ANTHROPIC_VERSION,
    max_tokens: maxTokens,
    system: question.systemPrompt || TECHNICAL_ASSISTANT_PROMPT,
    messages: [
      ...toHistoryMessages(question.history),
      { role: 'user', content: toQuestionContent(question) },
    ],
  });
