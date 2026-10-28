import { divideRoundHalfUp } from './roundHalfUp';

describe('divideRoundHalfUp', () => {
  it('rounds down below half a cent', () => {
    expect(divideRoundHalfUp(175000, 12)).toBe(14583); // 14583.33
  });

  it('rounds exactly half a cent up', () => {
    expect(divideRoundHalfUp(5, 2)).toBe(3);
    expect(divideRoundHalfUp(18, 12)).toBe(2); // 1.5
  });

  it('rounds up above half a cent', () => {
    expect(divideRoundHalfUp(170000, 12)).toBe(14167); // 14166.67
  });

  it('keeps exact results unchanged', () => {
    expect(divideRoundHalfUp(120, 12)).toBe(10);
    expect(divideRoundHalfUp(0, 12)).toBe(0);
  });

  it('refuses negative or fractional input and a zero denominator', () => {
    expect(() => divideRoundHalfUp(-1, 12)).toThrow(RangeError);
    expect(() => divideRoundHalfUp(1.5, 12)).toThrow(RangeError);
    expect(() => divideRoundHalfUp(10, 0)).toThrow(RangeError);
  });
});
