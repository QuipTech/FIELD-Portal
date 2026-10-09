import { blocksFromChunks, withoutOverlap } from './blocksFromChunks';

describe('withoutOverlap', () => {
  it('drops the text a chunk repeats from the previous one', () => {
    const previous =
      'Intro text. The repeated tail of the first chunk goes here.';
    expect(
      withoutOverlap(
        previous,
        'The repeated tail of the first chunk goes here.\nNew text.',
      ),
    ).toBe('New text.');
  });

  it('leaves a chunk with no overlap alone', () => {
    expect(withoutOverlap('Something else entirely.', 'Fresh start.')).toBe(
      'Fresh start.',
    );
  });
});

describe('blocksFromChunks', () => {
  it('finds numbered headings, but not numbered table rows', () => {
    const blocks = blocksFromChunks([
      {
        chunk_text:
          '4. Diagnostic Procedure\nStep Action Expected Result\n2 Check main relief valve setting 2850 PSI\n5. Corrective Action\nReplace the strainer.',
        page_number: 3,
        section_heading: null,
      },
    ]);
    expect(blocks).toEqual([
      { page: 3, text: '4. Diagnostic Procedure', isHeading: true },
      {
        page: 3,
        text: 'Step Action Expected Result\n2 Check main relief valve setting 2850 PSI',
        isHeading: false,
      },
      { page: 3, text: '5. Corrective Action', isHeading: true },
      { page: 3, text: 'Replace the strainer.', isHeading: false },
    ]);
  });
});
