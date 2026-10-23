const assertWholeCents = (value: number, name: string) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative whole number`);
  }
};

// numerator / denominator rounded half-up to a whole cent, in integer
// arithmetic so 14583.5 can't drift to 14583.499… (spec section 3, rule 7:
// annual over-commit is the only amount that needs rounding).
export const divideRoundHalfUp = (
  numerator: number,
  denominator: number,
): number => {
  assertWholeCents(numerator, 'numerator');
  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new RangeError('denominator must be a positive whole number');
  }
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
};
