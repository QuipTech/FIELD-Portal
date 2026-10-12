import { ResponseStream } from '@aws-sdk/client-bedrock-runtime';

// What one streamed answer adds up to.
export interface StreamedAnswer {
  text: string;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
}

// The Anthropic Messages streaming events Bedrock wraps in each chunk.
// Only the fields read here are typed.
interface AnthropicStreamEvent {
  type: string;
  message?: { usage?: { input_tokens?: number; output_tokens?: number } };
  delta?: { type?: string; text?: string; stop_reason?: string | null };
  usage?: { output_tokens?: number };
  'amazon-bedrock-invocationMetrics'?: {
    inputTokenCount?: number;
    outputTokenCount?: number;
  };
}

const decoder = new TextDecoder();

const applyEvent = (
  answer: StreamedAnswer,
  event: AnthropicStreamEvent,
): string | null => {
  if (event.type === 'message_start') {
    answer.inputTokens = event.message?.usage?.input_tokens ?? 0;
  }
  if (event.type === 'message_delta') {
    answer.stopReason = event.delta?.stop_reason ?? answer.stopReason;
    answer.outputTokens = event.usage?.output_tokens ?? answer.outputTokens;
  }
  // Bedrock's own count is the one it bills, so it wins when present.
  const metrics = event['amazon-bedrock-invocationMetrics'];
  if (metrics) {
    answer.inputTokens = metrics.inputTokenCount ?? answer.inputTokens;
    answer.outputTokens = metrics.outputTokenCount ?? answer.outputTokens;
  }
  const isText =
    event.type === 'content_block_delta' && event.delta?.type === 'text_delta';
  return isText ? (event.delta?.text ?? null) : null;
};

// Reads InvokeModelWithResponseStream's body, passing each text delta to
// onText. Error events in the stream (throttling, model errors) are
// thrown by the SDK while iterating, with the same names as on send().
export const readBedrockStream = async (
  body: AsyncIterable<ResponseStream>,
  onText: (text: string) => void,
): Promise<StreamedAnswer> => {
  const answer: StreamedAnswer = {
    text: '',
    stopReason: null,
    inputTokens: 0,
    outputTokens: 0,
  };
  for await (const part of body) {
    if (!part.chunk?.bytes) continue;
    const event = JSON.parse(
      decoder.decode(part.chunk.bytes),
    ) as AnthropicStreamEvent;
    const text = applyEvent(answer, event);
    if (text) {
      answer.text += text;
      onText(text);
    }
  }
  return answer;
};
