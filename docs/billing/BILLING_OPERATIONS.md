# Personal TECH payment operations

Apply migrations through backend/db/applyMigrations.sh with the migration role.
0098 creates personal account and period mappings; it does not change an
organisation's billing account or move existing data. Do not run migrations
against production as part of local tests.

The initial price is the existing TECH price book's 4900 cents, AUD ex GST.
Change prices by publishing a new TECH price-book version. An existing month's
invoice remains pinned. The next calendar month uses the version then in effect.

Non-Owners see a payment prompt after sign-in or registration, including invited
users and support staff. The first charge is for the current calendar month,
without proration, and the next month requires a new payment. This is the
user-requested override documented in implementationPlan.md; the original
specification is preserved in FIELD-billing-spec.md.

Payment is manual via Stripe hosted invoices. This implementation does not
save a default payment method or automatically charge recurring payments.
The prompt states this explicitly. Owners are exempt, based on database roles.

Configure Stripe keys, Stripe Tax, Australian GST registration and the existing
/webhooks/stripe endpoint as described in backend/STRIPE_SETUP.md. The payment
form collects an Australian billing address before invoice finalisation.
Development/staging must use test keys. No payment is created by simply logging
in; an invoice is created only when the user confirms the payment action.

Retries reuse the saved invoice. Signature-verified invoice.paid webhooks update
the FIELD invoice; the UI checks payment again after window focus and while
waiting. A return URL never grants access. A refunded or void invoice is
replaced: the user can confirm again and pays a fresh invoice for the month.
Users with an active TECH seat on their organisation's account are covered and
not charged personally.

## Monthly run (organisation accounts)

Enable with `BILLING_RUN_ENABLED=true`; it runs hourly and creates real
Stripe invoices, so leave it off where nobody watches the drafts. Per account
and in its time zone it snapshots each finished day, drafts the closed
month on or after the 1st (in arrears, from the month's peak), then
finalises the draft `INVOICE_REVIEW_HOURS` (24) later unless a platform
administrator held it (`POST /admin/billing/invoices/:id/hold`). Drafts in
review: `GET /admin/billing/invoices?status=draft`. Details:
backend/src/billing/monthlyRun/README.md.

No overdue-reminder, suspension, credit-note or partner-statement job exists
yet. Those remain required by the full specification; see
implementationPlan.md.
