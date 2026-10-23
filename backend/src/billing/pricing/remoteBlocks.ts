import { RemoteBlockRules, RemoteSessionCharge } from './pricingTypes';

const SECONDS_PER_MINUTE = 60;

// Blocks = ceil(seconds / block length). A session shorter than
// REMOTE_MIN_SECONDS is still metered but bills 0 blocks (spec decision:
// covers dropped connections).
export const calculateRemoteBlocks = (
  durationSeconds: number,
  rules: RemoteBlockRules,
): number => {
  if (!Number.isSafeInteger(durationSeconds) || durationSeconds < 0) {
    throw new RangeError('durationSeconds must be a non-negative whole number');
  }
  if (durationSeconds < rules.minSeconds) return 0;
  return Math.ceil(durationSeconds / (rules.blockMinutes * SECONDS_PER_MINUTE));
};

export const calculateRemoteSessionCharge = (
  durationSeconds: number,
  rules: RemoteBlockRules,
  blockCents: number,
): RemoteSessionCharge => {
  const billableBlocks = calculateRemoteBlocks(durationSeconds, rules);
  return {
    durationSeconds,
    billableBlocks,
    amountCents: billableBlocks * blockCents,
  };
};
