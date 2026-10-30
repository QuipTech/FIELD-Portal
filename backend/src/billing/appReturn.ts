// Where Stripe sends a payer or customer back: the portal's billing page, or
// (from the mobile app) the portal's /app-return/billing page, which hands
// straight back to the app. Stripe needs https, so the app's own scheme
// can't be the return URL itself.
export type ReturnTo = 'portal' | 'app';

export const returnPagePath = (returnTo: ReturnTo) =>
  returnTo === 'app' ? '/app-return/billing' : '/settings/billing';
