import { findCitedIndexes } from './findCitedIndexes';

describe('findCitedIndexes', () => {
  it('collects single, grouped and repeated citations in order', () => {
    expect(
      findCitedIndexes('Recharge [2]. Replace the bladder [1, 3][2].', 3),
    ).toEqual([1, 2, 3]);
  });

  it('ignores numbers with no matching source', () => {
    expect(findCitedIndexes('See [0] and [7].', 3)).toEqual([]);
  });

  it('returns nothing for an uncited answer', () => {
    expect(findCitedIndexes('Not enough information.', 2)).toEqual([]);
  });
});
