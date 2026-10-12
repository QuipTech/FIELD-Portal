import { buildTechnicalRequestBody } from './buildTechnicalRequestBody';
import { TECHNICAL_ASSISTANT_PROMPT } from './technicalAssistantPrompt';
import { TechnicalQuestion } from './types/technicalResponse';

const question: TechnicalQuestion = {
  tenantId: 't',
  question: 'Is this bladder damaged?',
  chunks: [
    {
      chunkId: 'c1',
      documentId: 'd1',
      title: 'Service manual',
      page: 214,
      heading: 'Brake accumulator',
      text: 'Pre-charge 9.5–10.5 MPa cold.',
    },
  ],
  image: { mediaType: 'image/jpeg', data: 'aGVsbG8=' },
  history: [
    { role: 'assistant', content: 'orphaned answer' },
    { role: 'user', content: 'E-2204 on cold start?' },
    { role: 'assistant', content: 'Check pre-charge [1].' },
  ],
};

const parse = (overrides: Partial<TechnicalQuestion> = {}) =>
  JSON.parse(buildTechnicalRequestBody({ ...question, ...overrides }, 1024));

describe('buildTechnicalRequestBody', () => {
  it('uses the Bedrock Anthropic version and the built-in prompt', () => {
    const body = parse();
    expect(body.anthropic_version).toBe('bedrock-2023-05-31');
    expect(body.max_tokens).toBe(1024);
    expect(body.system).toBe(TECHNICAL_ASSISTANT_PROMPT);
  });

  it('prefers the published admin prompt', () => {
    expect(parse({ systemPrompt: 'Published v3' }).system).toBe('Published v3');
  });

  it('starts history at the first user turn', () => {
    const roles = parse().messages.map((m: { role: string }) => m.role);
    expect(roles).toEqual(['user', 'assistant', 'user']);
  });

  it('puts the image block before the numbered sources and question', () => {
    const [image, text] = parse().messages.at(-1).content;
    expect(image).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' },
    });
    expect(text.type).toBe('text');
    expect(text.text).toContain(
      '[1] Service manual — p. 214 · Brake accumulator',
    );
    expect(text.text).toContain('Is this bladder damaged?');
  });

  it('tells Claude when nothing was retrieved', () => {
    const [text] = parse({ chunks: [], image: undefined }).messages.at(
      -1,
    ).content;
    expect(text.text).toContain('No approved sources matched');
  });
});
