import { toArticleSummary } from './articleSummary';

describe('toArticleSummary', () => {
  it('prefers a summary saved while indexing', () => {
    expect(toArticleSummary(' Saved summary. ', 'First paragraph.')).toBe(
      'Saved summary.',
    );
  });

  it("otherwise takes the first section's first paragraph", () => {
    expect(toArticleSummary(null, 'First paragraph.\n\nSecond.')).toBe(
      'First paragraph.',
    );
  });

  it('cuts a long paragraph at a sentence end', () => {
    const paragraph = `${'Short sentence here. '.repeat(30)}`.trim();
    const summary = toArticleSummary(null, paragraph)!;
    expect(summary.length).toBeLessThanOrEqual(400);
    expect(summary.endsWith('here.')).toBe(true);
  });

  it('is null with no text', () => {
    expect(toArticleSummary(null, null)).toBeNull();
  });
});
