import { chunkBlocks } from './chunkDocument';

const sentence = (words: number, tag: string) =>
  `${Array.from({ length: words }, (_, i) => `${tag}${i}`).join(' ')}.`;

describe('chunkBlocks', () => {
  it('keeps a short document in one chunk with its page and heading', () => {
    const chunks = chunkBlocks([
      { page: 1, text: 'Hydraulic pump', isHeading: true },
      {
        page: 1,
        text: 'Check the charge pressure before start-up.',
        isHeading: false,
      },
    ]);
    expect(chunks).toEqual([
      {
        page: 1,
        heading: 'Hydraulic pump',
        content: 'Hydraulic pump\nCheck the charge pressure before start-up.',
      },
    ]);
  });

  it('splits long text into ~800–1000-token chunks with ~100 tokens of overlap', () => {
    const body = Array.from({ length: 60 }, (_, i) =>
      sentence(40, `s${i}w`),
    ).join(' ');
    const chunks = chunkBlocks([{ page: 3, text: body, isHeading: false }]);

    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks)
      expect(chunk.content.length).toBeLessThanOrEqual(4000 + 400);
    for (const chunk of chunks.slice(0, -1))
      expect(chunk.content.length).toBeGreaterThanOrEqual(3000);
    // The start of each chunk repeats the end of the previous one.
    const tail = chunks[0].content.slice(-200);
    expect(chunks[1].content).toContain(
      tail.slice(tail.indexOf(' ') + 1, tail.indexOf(' ') + 60),
    );
  });

  it('labels each chunk with the page and heading where its new text starts', () => {
    const chunks = chunkBlocks([
      { page: 1, text: 'Brakes', isHeading: true },
      { page: 1, text: sentence(900, 'a'), isHeading: false },
      { page: 2, text: 'Suspension', isHeading: true },
      { page: 2, text: sentence(900, 'b'), isHeading: false },
    ]);
    const suspension = chunks.find((chunk) => chunk.content.includes('b0 '));
    expect(suspension).toMatchObject({ page: 2, heading: 'Suspension' });
    expect(chunks[0]).toMatchObject({ page: 1, heading: 'Brakes' });
  });
});
