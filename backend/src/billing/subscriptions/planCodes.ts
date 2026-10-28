// The stable plan and line codes from spec section 2 (platform.plans,
// migration 0095). Billing logic uses them to pick which subscription a
// charge belongs to; feature access never does — that goes through
// feature keys.
export const PLAN_CODES = {
  assetPro: 'ASSET_PRO',
  tech: 'TECH',
  remoteSession: 'REMOTE_SESSION',
  enterprise: 'ENTERPRISE',
  onboardAssisted: 'ONBOARD_ASSISTED',
  hardware: 'HARDWARE',
  internal: 'INTERNAL',
} as const;
