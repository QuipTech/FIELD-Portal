# Implemented billing API

All routes require a FIELD bearer token. Requests cannot specify the caller's
user, tenant, account or price. These come from the verified session and FIELD
tables. Money is integer AUD cents, ex GST unless stated. Billing periods are
calendar dates in the response timezone, with an exclusive periodEnd.

Card or 30-day accounts, free periods, promo codes, the overdue list and
mark-as-paid are documented in PAYMENT_TERMS.md.

## Personal TECH billing (only when REQUIRE_USER_SUBSCRIPTION is on)

`billing.config REQUIRE_USER_SUBSCRIPTION` defaults to false. Then
`GET /me/billing` returns `userSubscriptionRequired: false` and
`paymentRequired: false` for everyone, and `POST /me/billing/payment` returns
409 `user_subscription_not_required`. Everything below applies only when it's
on.

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

Body: `{ line1, city, state, postalCode, returnOrigin?, returnTo? }`, an
Australian billing address. State is ACT/NSW/NT/QLD/SA/TAS/VIC/WA; postalCode
is a four-digit string. `returnTo` is `"portal"` (default) or `"app"` (the
mobile app). Address is sent to the personal Stripe Customer so Stripe Tax can
calculate GST. No card information passes through FIELD.

Response is GET /me/billing plus:

```
paymentUrl:   string | null   // a Stripe page to pay on; null when nothing is due
paymentSheet: {               // null when nothing is due (see below)
  publishableKey: string,             // pk_ key, same Stripe account and mode as the server
  paymentIntentClientSecret: string,  // the invoice's own PaymentIntent
  customerId: string | null,          // enables saved cards
  customerEphemeralKeySecret: string | null, // only together with customerId; new on every call
  merchantDisplayName: string | null  // "FIELD"
} | null
```

**Portal** (`returnTo` omitted or `"portal"`): unchanged. `paymentUrl` is
Stripe Checkout, which returns to `/settings/billing`, or the hosted invoice
page when the invoice is already on Stripe. `paymentSheet` is always null.

**Mobile app** (`returnTo: "app"`): the month's invoice is created on Stripe
as a Stripe Invoice (Stripe Tax, card payments only) and finalised. Any open
Checkout session for it is expired first, so the invoice can only be paid one
way. `paymentSheet` carries the client secret of **that invoice's own
PaymentIntent** (`confirmation_secret`, Stripe API 2026-08-26.dahlia): paying
it in the Payment Sheet pays the invoice. No separate PaymentIntent is ever
created. `paymentUrl` is the same invoice's hosted page, for older app builds.
Repeat calls while the invoice is open return the same invoice and
PaymentIntent (with a fresh ephemeral key), never a second charge.

`paymentSheet` is null when:

- nothing is due: the month is paid, the caller is covered by their
  organisation, the Stripe invoice is paid, void or uncollectible, or its
  amount due is 0. `paymentRequired` is then false, or becomes false once
  the payment is recorded;
- the request is from the portal (see above);
- `STRIPE_PUBLISHABLE_KEY` is not configured. App requests then get Checkout
  exactly as before.

Owners (exempt) still receive 403. When `paymentSheet` is present,
`publishableKey` and `paymentIntentClientSecret` are non-empty strings.

The sheet closing is not a payment confirmation. Payment is recorded only from
Stripe: the `invoice.paid` webhook, or `POST /me/billing/payment/check` (which
reads the invoice from Stripe), so the app should call check when the sheet
closes. A declined card leaves the invoice open (`payment_failed`), and the
next call returns the same PaymentIntent to retry.

Owners receive 403. Invalid input receives 400. Stripe failures leave a saved
invoice for retry. One user and calendar month has exactly one invoice, with
a transaction advisory lock preventing concurrent creation. Stripe writes reuse
the existing invoice/item idempotency keys. A void or refunded invoice is
marked replaced (kept in the history and audited) and the month gets a fresh
invoice when the user confirms again. A payment_failed invoice is reused.

### POST /me/billing/payment/check

No body. Asks Stripe about this month's invoice and records it as paid if
Stripe has the payment (hosted page, Checkout or Payment Sheet), exactly as
the `invoice.paid` webhook would. Returns GET /me/billing.

### POST /me/billing/invoices/:invoiceId/payment-sheet

No body. Returns `{ paymentSheet }`, the same shape as above, for an earlier
invoice of the caller's that is still unpaid. The invoice is moved to a
card-only Stripe Invoice first if it is not on Stripe yet, using the billing
address already saved on the caller's Stripe customer. Returns 200 with
`{ paymentSheet: null }` for a paid, void or refunded invoice (or when the
publishable key is not configured), and 404 for an invoice that is not the
caller's own or a malformed id. Payment is recorded by the `invoice.paid`
webhook; `/me/billing/payment/check` only looks at this month's invoice.

### GET /me/billing/invoices

Returns up to 120 recent personal invoices, newest first, excluding drafts:
`[{ invoiceId, periodStart, periodEnd, status, totalExGstCents, gstCents,
totalCents, hostedInvoiceUrl }]`. Nullable amounts mean tax has not yet been
calculated. Only the authenticated user's invoices in their current tenant
are returned, including when multiple users share an organisation.

## Machine final charge

### POST /machines/:machineId/final-charge

Requires `machine.lifecycle`. Body: `{ returnOrigin? }`. Raises the machine's
final charge (one `machine_final` invoice, days used) if it isn't raised yet,
then returns GET /machines/:machineId/deletion-check plus:

```
paymentUrl:   string | null   // a Stripe page to pay on; null when nothing is left to pay
paymentSheet: {               // null when nothing is left to pay (see below)
  publishableKey: string,             // pk_ key, same Stripe account and mode as the server
  paymentIntentClientSecret: string,  // the final charge invoice's own PaymentIntent
  customerId: string | null,          // the organisation's Stripe customer (saved cards)
  customerEphemeralKeySecret: string | null, // only together with customerId; new on every call
  merchantDisplayName: string | null  // "FIELD"
} | null
```

**Portal** (`X-Field-Client: web`): unchanged. `paymentUrl` is Stripe Checkout
(it asks for the billing address and returns to `/machines/:id`), or the
hosted invoice page once the invoice is on Stripe. `paymentSheet` is always null.

**Mobile app** (any other `X-Field-Client`, including none): the final charge
invoice is created on Stripe as a Stripe Invoice (Stripe Tax, card payments
only) and finalised. Any open Checkout session for it is expired first (or
recorded, if it was already paid), so the charge can only be paid one way.
`paymentSheet` carries the client secret of **that invoice's own
PaymentIntent** (`confirmation_secret`, Stripe API 2026-08-26.dahlia). No
separate PaymentIntent is created, and none is stored. `paymentUrl` is the same
invoice's hosted page, for older app builds. Repeat calls while it's unpaid
return the same invoice and PaymentIntent (with a fresh ephemeral key).

`paymentSheet` is null when:

- nothing is left to pay: the charge is paid (`canDelete` may then be true),
  or Stripe already has the payment (it is recorded on the spot), or the
  Stripe invoice is void or has nothing due;
- the request is from the portal;
- `STRIPE_PUBLISHABLE_KEY` is not set, or Stripe Tax has no address for the
  organisation's Stripe customer yet. Checkout asks for the address and a
  Stripe Invoice can't, so the app gets Checkout in `paymentUrl` instead.
  After one Checkout payment the address is saved for next time.

Payment is never taken from the client. The `invoice.paid` webhook marks the
charge paid. GET /machines/:machineId/deletion-check also asks Stripe about an
unpaid invoice that is on Stripe, so the blocker clears even before the webhook
arrives. Once paid, deletion-check reports `canDelete: true` (when nothing
else blocks it). The app should call deletion-check when the sheet closes.

Errors: 409 with the blocker's `code` when the machine can't be charged yet
(for example still active), 502 with Stripe's message when Stripe fails (the
invoice stays saved; calling again retries).

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
