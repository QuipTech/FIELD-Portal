import { diffPromptLines } from './diffPromptLines';

describe('diffPromptLines', () => {
  it('marks unchanged, removed and added lines in order', () => {
    expect(
      diffPromptLines(
        'Be concise.\nCite sources.\nNo guesses.',
        'Be concise.\nCite the manual page.\nNo guesses.',
      ),
    ).toEqual([
      { type: 'same', text: 'Be concise.' },
      { type: 'removed', text: 'Cite sources.' },
      { type: 'added', text: 'Cite the manual page.' },
      { type: 'same', text: 'No guesses.' },
    ]);
  });

  it('handles lines appended at the end', () => {
    expect(diffPromptLines('A', 'A\nB')).toEqual([
      { type: 'same', text: 'A' },
      { type: 'added', text: 'B' },
    ]);
  });

  it('reports no changes for identical prompts', () => {
    expect(
      diffPromptLines('A\nB', 'A\nB').every((line) => line.type === 'same'),
    ).toBe(true);
  });
});
