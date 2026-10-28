import { toSectionId } from './sectionId';

describe('toSectionId', () => {
  it.each([
    ['4.3 Hydraulic pump', '4.3'],
    ['4.3. Hydraulic pump', '4.3'],
    ['12.1.4 Torque values', '12.1.4'],
    ['1. Purpose', '1'],
    ['7) Safety', '7'],
  ])('uses the number in "%s"', (heading, expected) => {
    expect(toSectionId(5, heading)).toBe(expected);
  });

  it.each([
    ['2 Check main relief valve', 's5'],
    ['Introduction', 's5'],
    [null, 's5'],
  ])('falls back to the anchor for "%s"', (heading, expected) => {
    expect(toSectionId(5, heading)).toBe(expected);
  });
});
