import { BadGatewayException } from '@nestjs/common';

interface StripeErrorShape {
  type?: string;
  message?: string;
  code?: string;
}

// Stripe SDK errors carry a type like 'StripeInvalidRequestError'.
export const isStripeError = (error: unknown): error is StripeErrorShape =>
  typeof (error as StripeErrorShape | null)?.type === 'string' &&
  (error as StripeErrorShape).type!.startsWith('Stripe');

// Stripe refused or failed a call: a 502 carrying Stripe's own message
// (e.g. a missing tax location), so the admin can see what to fix.
export const toStripeGatewayError = (error: unknown): unknown => {
  if (!isStripeError(error)) return error;
  const code = error.code ? ` (${error.code})` : '';
  return new BadGatewayException(
    `Stripe: ${error.message ?? 'request failed'}${code}`,
  );
};
