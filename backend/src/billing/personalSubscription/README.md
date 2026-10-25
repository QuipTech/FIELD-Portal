# Personal TECH payments

Every non-Owner pays individually, including invited organisation members.
This is an explicit user override of the original no-seat-charge rule.
Owner exemption is read from database roles. Price and month boundaries come
from the FIELD TECH price book and billing timezone configuration.

- personalSubscription.controller.ts: authenticated /me/billing routes.
- personalSubscription.service.ts: status and user-scoped invoice history.
- personalInvoice.service.ts: locked invoice preparation and existing Stripe sync.
- personalCheckout.service.ts: Stripe Checkout for a personal invoice. Stripe returns the
  payer to `<PORTAL_ORIGIN>/settings/billing?payment=complete` (or `=cancelled`) and
  creates a paid invoice tagged `fieldInvoiceId`, which the existing invoice webhooks
  match. An open session is reused, and a completed one is never paid twice. Invoices
  already sent to Stripe before Checkout keep their hosted invoice page.
- personalPaymentCheck.service.ts: `POST /me/billing/payment/check` asks Stripe for
  this month's invoice and records it as paid, so a missed webhook never locks out a payer.
- personalSubscription.repository.ts: reads restricted to user and tenant.
- personalSubscriptionTypes.ts: response types and payment confirmation rule.
- personalPaymentDto.ts: Australian billing-address validation.

Run tests from backend: `npx jest src/billing/personalSubscription --runInBand --watchman=false`.
Database RLS tests: `npm run test:db -- personalBillingIsolation` against a
disposable migrated PostgreSQL database, using its migration-owner connection.
No Stripe API calls occur in the unit or HTTP tests.

Apply migration 0098 before use. Stripe environment variables and operations
are covered by backend/STRIPE_SETUP.md and docs/billing/BILLING_OPERATIONS.md.
Only confirmed FIELD invoice payment satisfies the prompt. An open Stripe
payment URL does not. Existing organisation entitlements are unchanged.
