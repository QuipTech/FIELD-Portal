import { removeNulCharacters } from './documentBlocks';

describe('removeNulCharacters', () => {
  it('strips NUL characters that Postgres rejects', () => {
    const result = removeNulCharacters({
      blocks: [
        { page: 1, text: 'Engine\u0000 oil\u0000', isHeading: false },
        { page: 2, text: 'Clean text', isHeading: true },
      ],
      pageCount: 2,
      imageOnlyPages: [],
    });
    expect(result.blocks.map((block) => block.text)).toEqual([
      'Engine oil',
      'Clean text',
    ]);
    expect(result.pageCount).toBe(2);
  });
});
