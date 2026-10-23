import { REMOTE_BLOCK_CENTS_V1, REMOTE_RULES } from './priceBookV1Fixture';
import { calculateRemoteSessionCharge } from './remoteBlocks';

const charge = (seconds: number) =>
  calculateRemoteSessionCharge(seconds, REMOTE_RULES, REMOTE_BLOCK_CENTS_V1);

describe('REMOTE_SESSION blocks', () => {
  it('T15: 1 min 30 s is metered but not charged', () => {
    expect(charge(90)).toEqual({
      durationSeconds: 90,
      billableBlocks: 0,
      amountCents: 0,
    });
  });

  it('T16: 14 min is 1 block, A$35.00', () => {
    expect(charge(14 * 60)).toMatchObject({
      billableBlocks: 1,
      amountCents: 3500,
    });
  });

  it('T17: 15 min 00 s is 1 block, A$35.00', () => {
    expect(charge(15 * 60)).toMatchObject({
      billableBlocks: 1,
      amountCents: 3500,
    });
  });

  it('T18: 15 min 01 s is 2 blocks, A$70.00', () => {
    expect(charge(15 * 60 + 1)).toMatchObject({
      billableBlocks: 2,
      amountCents: 7000,
    });
  });

  it('T19: 47 min is 4 blocks, A$140.00', () => {
    expect(charge(47 * 60)).toMatchObject({
      billableBlocks: 4,
      amountCents: 14000,
    });
  });

  it('charges from exactly the minimum length', () => {
    expect(charge(119).billableBlocks).toBe(0);
    expect(charge(120).billableBlocks).toBe(1);
  });

  it('follows the configured block length', () => {
    const tenMinuteBlocks = { blockMinutes: 10, minSeconds: 0 };
    expect(
      calculateRemoteSessionCharge(15 * 60, tenMinuteBlocks, 2000)
        .billableBlocks,
    ).toBe(2);
  });

  it('refuses a negative duration', () => {
    expect(() => charge(-1)).toThrow(RangeError);
  });
});
