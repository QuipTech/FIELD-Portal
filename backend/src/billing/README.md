# Billing (`src/billing`)

## Purpose

FIELD-calculated invoicing through Stripe. FIELD owns every amount. Stripe
presents the invoice, adds GST (Stripe Tax) and collects payment. Charges are
sent as Invoice Items on a Stripe Invoice, with no Subscriptions, Prices or
Checkout. This is the only module allowed to import the Stripe SDK. Prices
come from a versioned price book and every other commercial value from
`billing.config` (spec section 11), so nothing is a literal in the
calculations. A billing account (one or many organisations) owns its
subscriptions and TECH seats. The monthly run (`monthlyRun/`) snapshots
billable days, drafts each closed month in arrears and finalises it after a
review window. Metering is still to come.

## Folder structure

```
billing/
├── billing.module.ts             ← wires the pieces; imports StripeModule + EmailModule
├── platformAdminOnly.decorator.ts← JWT + platform.manage guard for every admin route
├── stripe/                       ← StripeModule/StripeService: every Stripe call, idempotency keys, live-key guard
├── billingAccounts/              ← billing accounts + Stripe Customers; organisations list
├── billingConfig/                ← typed billing.config keys; loading refuses a missing or malformed value
├── pricing/                      ← pure price(n), annual, over-commit, TECH, remote blocks, Enterprise rules (T1–T19)
├── priceBooks/                   ← loads a pinned or in-effect price book with its bands
├── billingCalendar/              ← billing days in the account's time zone; month and term arithmetic
├── billingAudit/                 ← audit entries (from, to, reason) from the service role, jobs as 'system'
├── subscriptions/                ← per-account subscriptions: terms, renewal re-pinning, next term (monthly ↔ annual), cancellation and its end, Enterprise set-up (T8a, T27); the hourly renewal step
├── seats/                        ← TECH seats: add, reinstate, remove to month end; seats per day (T14)
├── signUp/                       ← new organisation's account + monthly ASSET_PRO (T22); annual up-front quote
├── invoices/                     ← draft → final → synced pipeline, amounts, statuses, invoice email; up-front invoices (annual term, onboarding); a card on file is charged automatically
├── monthlyRun/                   ← daily snapshots, monthly drafts, review window, finalisation (see its README)
├── webhooks/                     ← POST /webhooks/stripe: signature check, once-only events, status/totals only
├── adminInvoices/                ← admin billing page: every invoice by Paid/Unpaid/Failed/Pending/Refunded/Void; refresh from Stripe
├── billingOperations/            ← admin routes: suspension, Enterprise contracts, credit notes, onboarding, price books, config, review tasks
├── collections/                  ← overdue notices (day 1, day 7), suspension after the notice period, credit notes
├── allowance/                    ← fair use: monthly AI/storage/ingest allowance, 80% notice, 100% flag, plan review after 2 months over
├── onboarding/                   ← assisted onboarding jobs: invoiced once on completion, or waived with a reason
├── billingSettings/              ← price book versions, billing.config edits, review task list/updates
├── billingNotices/               ← in-app (bell, kind "billing") and email notices to billing admins and QuipTech
├── customerBilling/              ← customers' own invoices, Stripe PDF links, Customer Portal sessions (org + personal); the organisation plan page (summary, annual switch, cancel/keep)
├── planOptions/                  ← GET /organisation/subscription/options: plans + add-ons with today's list prices
└── billingFakeDatabase.ts        ← in-memory service pool for the specs
```

## How to run locally

```sh
npm run start:dev                                   # from backend/
stripe listen --forward-to localhost:4001/webhooks/stripe
npx jest src/billing                                # unit + HTTP specs
```

Full setup (keys, Stripe Tax, webhook endpoint, test cards, curl examples):
[../../STRIPE_SETUP.md](../../STRIPE_SETUP.md).

## Key conventions

- Every Stripe write passes an idempotency key (`stripe/stripeIdempotencyKeys.ts`).
  Each step also saves the Stripe id it got back, so a retried push skips
  work that's already done and never duplicates it.
- Money is integer cents everywhere (`bigint` columns, converted to numbers
  in `types/*Response.ts`).
- Tables live in the `billing` schema. Organisations can read their own
  billing account, subscriptions, seats, invoices and lines (RLS on
  `current_billing_account_id()`, migration 0096); config, price books and
  webhook events are service role only. All billing code reads and writes
  through `ServiceDatabaseService`.
- Every change that affects money or access writes its audit entry in the
  same transaction (`billingAudit/recordBillingAudit`), with from, to and
  reason. Scheduled jobs pass a null actor and are audited as `system`.
- Invoice status only moves forward (`invoices/invoiceStatuses.ts`), so late
  or out-of-order webhooks can't undo `paid`.
- Webhooks never touch subscriptions, entitlements or user access.
- Pricing functions in `pricing/` are pure: they take the pinned price
  book's bands and config values as arguments and never read a literal
  price, band or duration. A subscription pins `price_book_id`, so a new
  price book version never re-prices an existing contract.
- Prices (bands, TECH, remote block, onboarding, Enterprise minimum) live in
  the price book; every other section 11 value lives in `billing.config`.
  Neither is cached per process, because several containers share them.
- The only rounding is annual over-commit and extra annual TECH seats:
  half-up to the cent in integer arithmetic (`pricing/roundHalfUp.ts`).

## Environment variables required

Personal TECH payment endpoints and the confirmed non-Owner charging override
are documented in [personalSubscription/README.md](personalSubscription/README.md)
and [the API contract](../../../docs/billing/BILLING_API.md).
Migration 0098 must be applied before the portal's personal billing flow is used.

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_TAX_ENABLED`
- `BILLING_RUN_ENABLED` (monthly run; off unless `true`)
- `SERVICE_DATABASE_URL`
- `SES_FROM_EMAIL`, `NOTIFICATIONS_ENABLED` (for the invoice email)
