# Implemented billing API

All routes require a FIELD bearer token. Requests cannot specify the caller's
user, tenant, account or price. These come from the verified session and FIELD
tables. Money is integer AUD cents, ex GST unless stated. Billing periods are
calendar dates in the response timezone, with an exclusive periodEnd.

## Personal TECH billing (every non-Owner)

### GET /me/billing

Response: `{ exempt, coveredByOrganisation, paymentRequired, monthlyCents, priceBookId, currency: "AUD",
timezone, periodStart, periodEnd, invoiceId, invoiceStatus, gstCents, totalCents,
hostedInvoiceUrl }`. Invoice fields and priceBookId may be null. Owners are
exempt. Roles are read on the server, never accepted from localStorage.
An organisation's fleet payment does not count as the caller's personal payment.
An active TECH seat for the caller on their own organisation's billing account
(live TECH subscription, seat covering today) does: `coveredByOrganisation` is
true and no personal payment is required, so the user is never charged twice.
A redirect or a client query parameter never confirms payment. Only the FIELD
invoice's paid status and recorded paid amount confirm it.

### POST /me/billing/payment

Body: `{ line1, city, state, postalCode }`, an Australian billing address.
State is ACT/NSW/NT/QLD/SA/TAS/VIC/WA; postalCode is a four-digit string.
Address is sent to the personal Stripe Customer so Stripe Tax can calculate GST.
No card information passes through FIELD. Response is GET /me/billing plus
`paymentUrl`, a Stripe hosted invoice URL (null if already paid).

Owners receive 403. Invalid input receives 400. Stripe failures leave a saved
invoice for retry. One user and calendar month has exactly one invoice, with
a transaction advisory lock preventing concurrent creation. Stripe writes reuse
the existing invoice/item idempotency keys. A void or refunded invoice is
marked replaced (kept in the history and audited) and the month gets a fresh
invoice when the user confirms again. A payment_failed invoice is reused.

### GET /me/billing/invoices

Returns up to 120 recent personal invoices, newest first, excluding drafts:
`[{ invoiceId, periodStart, periodEnd, status, totalExGstCents, gstCents,
totalCents, hostedInvoiceUrl }]`. Nullable amounts mean tax has not yet been
calculated. Only the authenticated user's invoices in their current tenant
are returned, including when multiple users share an organisation.

## Existing platform admin APIs

Require platform.manage (the existing Owner role), not a new super_admin role.

- GET /admin/billing/organisations
- POST /admin/billing/accounts
- POST /admin/billing/test-invoices
- GET /admin/billing/invoices
- GET /admin/billing/invoices/:invoiceId
- POST /admin/billing/invoices/:invoiceId/hold, body `{ reason }`: stops a
  monthly run draft from finalising. 409 unless it is a run draft in review.
- POST /admin/billing/invoices/:invoiceId/release, body `{ reason? }`: the
  draft finalises on the next hourly run once its window has passed.

Invoice responses also carry `periodStart`, `periodEnd`, `reviewUntil`,
`heldAt` and `holdReason` (null for personal and test invoices), and each
line its `calcSnapshot` (peak, peak day, pinned price book and bands).

## Existing lifecycle APIs

- GET /machines/:machineId/lifecycle
- POST /machines/:machineId/lifecycle
- POST /machines/lifecycle/bulk
- GET /machines/:machineId/custody
- POST /machines/:machineId/transfers
- GET /machine-transfers
- POST /machine-transfers/:transferId/approve (receiving organisation; body
  `{ note? }`). The machine moves to the buyer as `registered` with its
  installed systems and configuration snapshots; history, resolutions, photos,
  cases and AI chats stay with the seller. The seller's charge ends on the 1st
  of next month in their billing time zone. 409 when the machine left active
  or the buyer already has that serial number.
- POST /machine-transfers/:transferId/reject
- POST /machine-transfers/:transferId/cancel

## Organisation billing (billing.manage: Owner, Organisation Admin)

- GET /organisation/billing: account (suspension, Stripe customer), the main
  live plan (term, period, next term, pinned price book and bands), this
  month (active machines today, peak so far, rate, charge so far ex GST,
  invoice date), overdue invoices and when suspension becomes possible, and
  this month's fair-use rows.
- GET /organisation/billing/annual-quote?committedQty=Q: price(Q) × 10 up front.
- PUT /organisation/billing/next-term, body `{ term: 'annual', committedQty }`
  or `{ term: 'monthly' }`: takes effect at the next renewal (monthly plans
  renew on the 1st). The annual term is invoiced up front then.
- POST /organisation/billing/cancel, body `{ reason }`: ends at the end of
  the current term; DELETE /organisation/billing/cancel keeps the plan.
- GET /organisation/billing/invoices, GET …/invoices/:id/pdf, POST
  /organisation/billing/portal-session (now billing.manage, was
  admin.manage_settings): a card or direct debit saved there is charged
  automatically for new invoices.

## Billing operations (platform.manage)

- POST /admin/billing/accounts/:id/suspend and /unsuspend, body `{ reason }`.
  Suspension needs an unpaid invoice whose first overdue notice is at least
  `SUSPENSION_NOTICE_DAYS` (14) old; it refuses new activations and new AI
  sessions only (403 `account_suspended`).
- POST /admin/billing/accounts/:id/enterprise, body
  `{ annualQuoteCents, committedMachines, reason }` (T8a minimum enforced).
- GET/POST /admin/billing/invoices/:id/credit-notes, body
  `{ amountCents, reason }` (GST included, at most the uncredited total);
  POST /admin/billing/credit-notes/:id/retry after a Stripe failure.
- GET /admin/billing/onboarding, POST /admin/billing/onboarding
  `{ billingAccountId, siteName }`, POST …/:id/complete (invoices
  ONBOARD_ASSISTED once), POST …/:id/waive `{ reason }`.
- GET/POST /admin/billing/price-books (a new version from a future or today's
  date; ASSET_PRO bands must cover 1 upward with no gap).
- GET /admin/billing/config, PUT /admin/billing/config/:key `{ value }`.
- GET /admin/billing/review-tasks?status=open|closed, PATCH …/:id
  `{ status, notes? }`.
- GET /admin/billing/overview/invoices, POST …/refresh-from-stripe.

## Feature keys

GET /organisation/entitlements now lists the spec's feature keys from the
organisation's live plans. Routes check them with `@RequireFeature`
(403 `feature_not_in_plan`): registering machines (`fleet.register`),
inviting team members (`org.users.unlimited`), organisation branding
(`whitelabel`), new AI threads (`ai.assistant`) and full machine access
(`asset.history`, so an active machine on an ended plan is limited).

## Webhook

POST /webhooks/stripe requires a verified Stripe-Signature, not a FIELD token.
The existing idempotent handler updates FIELD invoice status and totals only.
It does not mutate organisation entitlements or subscriptions.

## Not yet implemented

Remote sessions (live video, `remote.session` metering, REMOTE_SESSION
invoice lines) and partner billing (partners, agreements, margins,
statements). Their prices are already in the price book (REMOTE_SESSION
A$35 per block) and billing.config (PARTNER_DEFAULT_MARGIN_BPS), editable
under Admin → Billing → Prices & settings. Fleet import (Excel/CSV) has no
endpoint yet; `fleet.import` is ready for it. The portal must not call
speculative endpoints for those features.
