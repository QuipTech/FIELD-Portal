# Monthly billing run (`src/billing/monthlyRun`)

## Purpose

Invoices organisation billing accounts monthly in arrears (billing spec
sections 3 and 9). Each hour, per account and in the account's time zone, it:

1. **Snapshots** every finished day into `billing.daily_billable_counts`
   (active machines from activation intervals, TECH seats from seat
   intervals). Missed days are backfilled with the same numbers; a written
   day is never changed.
2. **Drafts** the closed month's invoice once: ASSET_PRO on the month's peak
   machines, ASSET_PRO_OVER_COMMIT for annual accounts, TECH on the peak
   seats (or extra seats above an annual commitment). Every line stores a
   `calc_snapshot` (peak, peak day, pinned price book and bands).
3. **Finalises** drafts after `INVOICE_REVIEW_HOURS` (24) unless a platform
   administrator has held them, then pushes them to Stripe and emails the
   billing contact.

Personal TECH accounts (`/me/billing`) pay up front and are skipped.
Enterprise and internal plans add no monthly lines. Remote sessions are not
metered yet, so no REMOTE_SESSION lines are produced.

## Folder structure

```
monthlyRun/
├── billingRun.worker.ts            ← hourly cron: snapshot + draft, then finalise due drafts
├── monthlyRun.service.ts           ← per account: snapshots, closed-month draft (advisory lock, audited)
├── monthlyLineCalculation.ts       ← pure: peak, invoice lines, recalculation from a snapshot (T9–T14, T31)
├── dailyCountRules.ts              ← pure: daily counts from intervals
├── invoiceReview.service.ts        ← finalise due drafts; hold and release (audited)
├── invoiceReview.controller.ts     ← POST /admin/billing/invoices/:id/hold and /release
├── dailyBillableCounts.repository.ts
├── runInvoices.repository.ts
├── monthlyRunTypes.ts
└── dto/                            ← hold/release request validation
```

## How to run locally

```sh
BILLING_RUN_ENABLED=true npm run start:dev    # from backend/; the job runs on the hour
npx jest src/billing/monthlyRun
```

## Key conventions

- Safe to repeat: snapshots use `ON CONFLICT DO NOTHING` and one run invoice
  per account and month is enforced by `uq_invoices_account_period`.
- A failed Stripe push leaves the invoice as it is; the next hour retries
  without duplicating anything (same idempotency keys as every invoice).
- Prices come only from each subscription's pinned price book; review
  hours come from `billing.config`.

## Environment variables required

- `BILLING_RUN_ENABLED` (must be `true` for the job to run; it creates real
  Stripe invoices)
- Everything the billing module needs: `STRIPE_SECRET_KEY`,
  `STRIPE_TAX_ENABLED`, `SERVICE_DATABASE_URL`, `SES_FROM_EMAIL`,
  `NOTIFICATIONS_ENABLED`
