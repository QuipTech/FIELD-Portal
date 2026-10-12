import { ResponseStream } from '@aws-sdk/client-bedrock-runtime';
import { readBedrockStream } from './readBedrockStream';

const encoder = new TextEncoder();

const toStream = async function* (
  events: object[],
): AsyncGenerator<ResponseStream> {
  for (const event of events) {
    yield { chunk: { bytes: encoder.encode(JSON.stringify(event)) } };
  }
};

describe('readBedrockStream', () => {
  it('collects text deltas, stop reason and Bedrock token counts', async () => {
    const deltas: string[] = [];
    const answer = await readBedrockStream(
      toStream([
        { type: 'message_start', message: { usage: { input_tokens: 90 } } },
        { type: 'content_block_start', index: 0 },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Torque to ' },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: '450 N·m [1].' },
        },
        {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' },
          usage: { output_tokens: 12 },
        },
        {
          type: 'message_stop',
          'amazon-bedrock-invocationMetrics': {
            inputTokenCount: 100,
            outputTokenCount: 12,
          },
        },
      ]),
      (text) => deltas.push(text),
    );
    expect(deltas).toEqual(['Torque to ', '450 N·m [1].']);
    expect(answer).toEqual({
      text: 'Torque to 450 N·m [1].',
      stopReason: 'end_turn',
      inputTokens: 100,
      outputTokens: 12,
    });
  });

  it('rethrows errors raised while reading the stream', async () => {
    const failing = async function* (): AsyncGenerator<ResponseStream> {
      yield* toStream([{ type: 'message_start', message: {} }]);
      throw Object.assign(new Error('slow down'), {
        name: 'ThrottlingException',
      });
    };
    await expect(readBedrockStream(failing(), () => {})).rejects.toMatchObject({
      name: 'ThrottlingException',
    });
  });
});
