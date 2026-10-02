import { LightRoutingThresholds } from './bedrockConfig';
import { selectModelTier } from './selectModelTier';
import { TechnicalQuestion } from './types/technicalResponse';

const thresholds: LightRoutingThresholds = {
  isEnabled: true,
  maxQuestionChars: 50,
  maxContextChars: 100,
  maxHistoryMessages: 2,
};

const chunk = (text: string) => ({
  chunkId: 'c',
  documentId: 'd',
  title: 'Manual',
  page: 1,
  heading: null,
  text,
});

const buildQuestion = (
  overrides: Partial<TechnicalQuestion> = {},
): TechnicalQuestion => ({
  tenantId: 't',
  question: 'Upper mount torque?',
  chunks: [chunk('Torque 450 N·m.')],
  history: [],
  ...overrides,
});

describe('selectModelTier', () => {
  it('routes a short lookup with little context to the light model', () => {
    expect(selectModelTier(buildQuestion(), thresholds)).toBe('light');
  });

  it('keeps photos on the primary model', () => {
    const question = buildQuestion({
      image: { mediaType: 'image/jpeg', data: 'abc' },
    });
    expect(selectModelTier(question, thresholds)).toBe('primary');
  });

  it('keeps long questions, long context and long threads on primary', () => {
    const cases: Partial<TechnicalQuestion>[] = [
      { question: 'x'.repeat(51) },
      { chunks: [chunk('x'.repeat(60)), chunk('x'.repeat(60))] },
      {
        history: [
          { role: 'user', content: 'a' },
          { role: 'assistant', content: 'b' },
          { role: 'user', content: 'c' },
        ],
      },
    ];
    cases.forEach((overrides) =>
      expect(selectModelTier(buildQuestion(overrides), thresholds)).toBe(
        'primary',
      ),
    );
  });

  it('always uses primary when light routing is off', () => {
    expect(
      selectModelTier(buildQuestion(), { ...thresholds, isEnabled: false }),
    ).toBe('primary');
  });
});
