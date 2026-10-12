import { ConfigService } from '@nestjs/config';
import { BedrockConfig } from './bedrockConfig';
import { BedrockService } from './bedrock.service';

const encoder = new TextEncoder();

const streamOf = async function* (text: string) {
  const events = [
    { type: 'content_block_delta', delta: { type: 'text_delta', text } },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: {} },
  ];
  for (const event of events) {
    yield { chunk: { bytes: encoder.encode(JSON.stringify(event)) } };
  }
};

const setupError = () =>
  Object.assign(new Error('no access'), { name: 'AccessDeniedException' });

const buildService = (send: jest.Mock) => {
  const service = new BedrockService(
    new BedrockConfig(
      new ConfigService({
        BEDROCK_ANSWER_MODEL_ID: 'primary-model',
        BEDROCK_LIGHT_MODEL_ID: 'light-model',
      }),
    ),
  );
  Object.assign(service, { client: { send } });
  return service;
};

const shortQuestion = {
  tenantId: 't',
  question: 'Torque?',
  chunks: [],
  history: [],
};

describe('BedrockService.generateTechnicalResponse', () => {
  it('falls back to the primary model when the light model is not enabled', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(setupError())
      .mockResolvedValueOnce({ body: streamOf('450 N·m [1]') });
    const result = await buildService(send).generateTechnicalResponse(
      shortQuestion,
      { onText: () => undefined },
    );
    expect(send.mock.calls.map(([command]) => command.input.modelId)).toEqual([
      'light-model',
      'primary-model',
    ]);
    expect(result).toMatchObject({ tier: 'primary', text: '450 N·m [1]' });
  });

  it('reports a safe error when the primary model is not enabled', async () => {
    const send = jest.fn().mockRejectedValue(setupError());
    await expect(
      buildService(send).generateTechnicalResponse(
        { ...shortQuestion, question: 'x'.repeat(500) },
        { onText: () => undefined },
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
