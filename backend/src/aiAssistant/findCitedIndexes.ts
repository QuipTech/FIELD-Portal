// "[1]", "[2, 3]", "[1][4]" → the source numbers an answer cites, in
// ascending order, limited to sources that exist.
const CITATION_PATTERN = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

export const findCitedIndexes = (
  answer: string,
  sourceCount: number,
): number[] => {
  const cited = new Set<number>();
  for (const match of answer.matchAll(CITATION_PATTERN)) {
    match[1]
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((index) => index >= 1 && index <= sourceCount)
      .forEach((index) => cited.add(index));
  }
  return [...cited].sort((a, b) => a - b);
};
