# Machine-only billing, 30-day accounts, free periods and promo codes

Organisations are billed only for their active machines (peak per month,
fleet-size bands, spec section 3). There is no user paywall by default. An
organisation pays by **card** (Stripe charges a saved card) or on a **30-day
account** approved by a platform administrator (the existing Owner /
`platform.manage` role; "super admin" in the brief). Free periods and promo
codes discount machine charges.

Migrations: `0131_billing_payment_types.sql`, `0132_billing_free_periods_promo_codes.sql`.

## Decisions

Confirmed by the product owner on 18 November 2026:

1. Suspension's notice period (`SUSPENSION_NOTICE_DAYS`, 14) counts from the
   **earliest unpaid due date**, not from a reminder.
2. While an application is pending or on hold, invoices use the **card flow**
   (saved card charged, otherwise emailed with `PAYMENT_TERMS_DAYS`).
3. `po_required` with no PO number: the invoice still goes out, marked
   "PO number: Not provided", and platform admins are notified.
4. Free periods discount **machine charges only**, like promos.
5. With `REQUIRE_USER_SUBSCRIPTION` false, the monthly run adds **no TECH seat
   lines**.

## Configuration (`billing.config`, Admin → Billing → Prices & settings)

| Key | Default | Meaning |
| --- | --- | --- |
| `REQUIRE_USER_SUBSCRIPTION` | `false` | On: the personal A$49 TECH payment and organisation TECH seat lines come back. |
| `ACCOUNT_DEFAULT_TERMS_DAYS` | `30` | Terms offered when approving an account. |
| `BANK_ACCOUNT_NAME`, `BANK_BSB`, `BANK_ACCOUNT_NUMBER` | `""` | Printed in account invoice footers. **Fill these in before approving the first account**: with them empty, the footer is left out. |
| `PAYMENT_REFERENCE_FORMAT` | `FIELD-{invoiceRef}` | `{invoiceRef}` = first 8 characters of the FIELD invoice id; `{accountName}` also works. |
| `INVOICE_REMINDER_OFFSET_DAYS` | `[-7, 0, 7, 14]` | Reminder days relative to the due date. Card invoices charged automatically only get offsets ≥ 0. |

## Behaviour

- **No paywall.** `GET /me/billing` returns `userSubscriptionRequired: false`
  and `paymentRequired: false` for everyone; `POST /me/billing/payment` returns
  409 `user_subscription_not_required`. The portal hides the payment prompt and
  shows the Billing nav item to `billing.manage` users only. The mobile app's
  "subscription is due" screen is driven by `paymentRequired`, so it stops
  without an app release (confirm in the mobile repo).
- **Applying** sets `account_status = pending` and notifies platform admins
  (bell and email). Nothing is blocked. Approve, reject or hold is audited and
  the organisation's billing admins and the accounts email are told. A rejected
  organisation stays on card and is asked to add one.
- **Account invoices** (only `payment_type = account` with `account_status =
  approved`): Stripe `send_invoice`, `days_until_due = terms_days`, bank details
  in the footer, PO number as a custom field. No card is charged.
- **Mark as paid** calls Stripe `invoices.pay(paid_out_of_band: true)`, then
  sets the FIELD invoice paid with date, method and reference (audited). Only
  for unpaid invoices that Stripe emails (not ones charged to a card).
- **Reminders** are recorded in `billing.invoice_reminders` (one per invoice
  and offset). Only the latest reminder due is sent, so a missed run never
  sends a burst. Recipients: billing contact, accounts email, billing admins.
- **Credit limit**: platform admins are warned once each time the unpaid
  balance goes over it; the flag clears when it's back under. Never blocks.
- **Suspension** stays a manual platform admin action (existing flow).
- **Discounts** (`DiscountService`): free period first, then the promo on
  what's left, on `ASSET_PRO` and `ASSET_PRO_OVER_COMMIT` lines only, never
  below A$0. Each is a negative invoice line (`FREE_PERIOD_DISCOUNT`,
  `PROMO_DISCOUNT`) with its inputs in `calc_snapshot`, and a negative Stripe
  invoice item. No Stripe coupons or subscriptions.
- **Free period**: the month containing `free_until` is the last discounted
  month. A month that comes to A$0 is stored (`status = paid`,
  `no_charge_reason = fully_discounted`) and never sent to Stripe or emailed.
- **Promo codes**: case-insensitive; one active promo per account (advisory
  lock); a code is redeemed once per account; it runs from the month still open
  for `duration_months` (null = forever). "New customer" = nothing invoiced
  above A$0 yet. A redeemed code's discount and length can't be edited.

## API

### Organisation (`billing.manage`)

| Method and path | Body | Notes |
| --- | --- | --- |
| `GET /organisation/billing/payment-terms` | | Terms, application, free period, current promo, the monthly draft open for a PO. |
| `POST /organisation/billing/account-application` | `{ legalName, abn, accountsEmail, accountsPhone, poRequired, notes? }` | 409 if pending, on hold or already approved. |
| `PUT /organisation/billing/payment-type` | `{ paymentType: "card" }` | Withdraws an undecided application. |
| `PUT /organisation/billing/po-number` | `{ poNumber \| null }` | Standing PO. |
| `PUT /organisation/billing/invoices/:invoiceId/po-number` | `{ poNumber \| null }` | Drafts only (409 otherwise). |
| `POST /organisation/billing/promo-code/validate` | `{ code }` | Preview, or 422 `{ code, message }`. |
| `POST /organisation/billing/promo-code` | `{ code }` | Redeem. 422 codes: `invalid`, `expired`, `fully_used`, `new_customers_only`, `already_used`, `promo_already_active`. |

### Platform administrator (`platform.manage`)

| Method and path | Body |
| --- | --- |
| `GET /admin/billing/account-applications?status=` | pending, on hold, approved, rejected; pending first |
| `POST /admin/billing/accounts/:id/account-application/approve` | `{ termsDays?, creditLimitCents?, notes? }` |
| `POST /admin/billing/accounts/:id/account-application/reject` | `{ reason }` |
| `POST /admin/billing/accounts/:id/account-application/hold` | `{ reason }` |
| `PUT /admin/billing/accounts/:id/payment-terms` | `{ paymentType, termsDays?, creditLimitCents?, poRequired?, reason }` |
| `PUT /admin/billing/accounts/:id/credit-limit` | `{ creditLimitCents \| null, reason }` |
| `PUT /admin/billing/accounts/:id/free-period` | `{ freeUntil, freePercent?, reason }` |
| `POST /admin/billing/accounts/:id/free-period/clear` | `{ reason }` |
| `GET /admin/billing/overdue` | |
| `POST /admin/billing/invoices/:id/mark-paid` | `{ paidOn, method: bank_transfer\|cheque\|cash\|other, reference? }` |
| `GET` / `POST /admin/billing/promo-codes` | create: `{ code, description, discountType, discountValue, durationMonths, validFrom, validUntil, maxRedemptions, newCustomersOnly }` |
| `PATCH /admin/billing/promo-codes/:id` | same, without `code` |
| `PUT /admin/billing/promo-codes/:id/active` | `{ active }` |
| `GET /admin/billing/promo-codes/:id/redemptions` | |

Changed responses: `GET /admin/billing/organisations` adds `paymentType`,
`accountStatus`, `freePeriod` and renames `firstOverdueNoticeAt` to
`firstOverdueDueOn`; `GET /organisation/billing` renames `overdue.firstNoticeAt`
to `overdue.firstDueOn`; admin invoice rows add `collectionMethod`, `poNumber`,
`paymentType`, `markedPaidOn`, `noChargeReason`, `canMarkPaid`.

## Screens

- `/settings/billing` (org admins): "How you pay" card with card or account,
  application status, free period badge, PO numbers, "Have a promo code?".
  Non-admins see "Billing is handled by your organisation".
- `/onboarding/billing`: the sign-up step, linked from a dashboard banner shown
  to a new organisation's billing admins until they visit it or dismiss it.
- `/admin/billing-accounts`: new tabs **Account applications**, **Overdue**,
  **Promo codes**; account actions **Card or 30-day account** and **Free
  period**; **Mark as paid** on invoices.

## Manual test plan (Stripe test mode, never production)

Set up as in BILLING_TEST_PLAN.md section 0. Fill in the bank details first.

| ID | Steps | Expected |
| --- | --- | --- |
| P1 | Sign in as a non-admin member. | No payment popup anywhere; no Billing nav item; `/settings/billing` says billing is handled by the organisation. |
| P2 | As org admin, Billing → Apply for a 30-day account. | Status "pending"; platform admins get a bell notification and email; machines can still be activated. |
| P3 | As OWN, Admin → Billing → Account applications → Approve (30 days, A$1,000 limit). | Org admins notified; table shows "30-day account". |
| P4 | Run the monthly invoice run for that org (`BILLING_RUN_ENABLED=true`). | Stripe test invoice: "Send invoice", due in 30 days, bank details in footer, PO field; no charge attempted. |
| P5 | Invoices tab → Mark as paid (bank transfer, reference). | Stripe invoice "Paid out of band"; FIELD status paid. |
| P6 | Reject a second org's application. | Org admin sees "add a card" banner. |
| P7 | Set a 100% free period ending this month; run the month. | Invoice stored with a discount line at A$0, nothing on Stripe, no email. |
| P8 | Create codes: 20% for 3 months; A$50 fixed; expired; max 1 used; new customers only. Redeem each. | Clear message for each refusal; the valid code shows on the Billing page and as a negative line on the next invoice. |
| P9 | Leave an account invoice unpaid past due. | Reminders at −7, 0, +7, +14 days, once each; Overdue tab lists it; over the limit warns OWN once; never auto-suspended. |
