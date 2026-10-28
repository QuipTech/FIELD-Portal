# Billing test plan (manual)

Covers everything billing-related that is built today. Section A's happy
path (a non-Owner pays this month from the portal) is already verified. Run
everything in **Stripe test mode / sandbox** against the dev database. Never
use production.

Features that are specified but not built yet are listed under "Out of scope"
at the end. Don't log bugs against those.

---

## 0. Setup (do once)

1. Apply migrations from `backend/`:
   `MIGRATION_DATABASE_URL=… PGSSLROOTCERT=certs/rdsGlobalBundle.pem sh db/applyMigrations.sh`
2. Forward webhooks, using the **same sandbox as `STRIPE_SECRET_KEY`**:
   ```sh
   stripe listen --api-key "$(grep '^STRIPE_SECRET_KEY=' .env.development | cut -d= -f2-)" \
     --events invoice.finalized,invoice.paid,invoice.payment_failed,charge.refunded \
     --forward-to localhost:4001/webhooks/stripe
   ```
   Put the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET` and restart the backend.
3. Create these test users:

   | Name  | Role                                    | Tenant   | Used for |
   | ----- | --------------------------------------- | -------- | -------- |
   | OWN   | Owner (has `platform.manage`)           | Tenant A | exemption, admin APIs |
   | ADM   | Organisation Admin (`machine.lifecycle`) | Tenant A | lifecycle, transfers |
   | TECH1 | Non-Owner member                        | Tenant A | personal payment |
   | TECH2 | Non-Owner member                        | Tenant A | isolation from TECH1 |
   | TECH3 | Non-Owner member                        | Tenant B | cross-tenant isolation, transfers |

4. For the API cases, get a token from the browser while signed in:
   DevTools → Console → `localStorage.getItem("field.accessToken")`.
   ```sh
   API=http://localhost:4001
   TOKEN=<paste>
   ```

**Test cards** (any future expiry, any CVC). Leave the optional Stripe "Link"
section empty. An Australian mobile must start with 4.

| Card                  | Result |
| --------------------- | ------ |
| `4242 4242 4242 4242` | succeeds |
| `4000 0000 0000 9995` | declined (insufficient funds) |
| `4000 0025 0000 3155` | 3D Secure challenge, then succeeds |

---

## A. Personal subscription: remaining customer cases

| ID  | Steps | Expected |
| --- | ----- | -------- |
| A1  | Sign in as **OWN**. | No payment popup. `/settings/billing` shows "Owner account", exempt. |
| A2  | As OWN: `curl -X POST $API/me/billing/payment -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"line1":"1 St","city":"Brisbane","state":"QLD","postalCode":"4000"}'` | `403`. No invoice is created. |
| A3  | Sign in as unpaid **TECH2** and open any page (dashboard, machines…). | Popup shows A$49.00 ex GST, the current month and "no trial or proration". It can't be dismissed (no ×, Esc does nothing). Log out still works. |
| A4  | As TECH2, go to `/settings/billing`. | No popup over the page. Status reads "Payment required" with a **Review and pay** button. The popup here **can** be closed. |
| A5  | Submit the form with postcode `40` / `ABCD`, and with empty street or city. | The browser blocks submission. No request is sent. |
| A6  | API: post the payment request with `"state":"XX"` or `"postalCode":"123"`. | `400`. |
| A7  | Confirm and pay. On Stripe, pay with **9995 (declined)**. | Stripe shows the decline. Back in the portal: still "Payment required". The invoice row shows `payment failed` or stays `synced`. Access is still blocked. |
| A8  | Press Back, then Confirm and pay again. | The **same** Stripe invoice opens (same invoice number). Stripe Dashboard → Invoices shows only one invoice for TECH2 this month. |
| A9  | Pay that invoice with **3155 (3D Secure)** and complete the challenge. | Paid. Within about 15 seconds of returning (or on tab focus), the popup disappears and the invoice row shows `paid`. |
| A10 | Rapidly double-click Confirm, or submit from two tabs at once. | Still only one invoice for the month, in both FIELD and Stripe. |
| A11 | Open a paid invoice URL and refresh it, or type `/?paid=1` in the address bar. | Nothing changes. Only the webhook marks an invoice paid. |
| A12 | Stop `stripe listen`, pay a fresh user's invoice, then wait 1 minute. | The portal still says "Payment required", because no webhook arrived. Restart the listener and run `stripe events resend <evt_id> --api-key …`. The status then flips to paid. |
| A13 | As **TECH1** (paid) call `GET /me/billing/invoices`. Repeat as TECH2 and TECH3. | Each user sees only their own invoices. TECH1's invoice never appears for TECH2 (same tenant) or TECH3 (other tenant). |
| A14 | Look at the invoice in the Stripe Dashboard. | Customer is TECH1's email. Address is the one entered. One line: A$49.00 ex GST + A$4.90 GST = A$53.90. Due in 14 days (`PAYMENT_TERMS_DAYS`). |
| A15 | **Refund**: Stripe Dashboard → TECH1's payment → Refund (full). | The `charge.refunded` webhook arrives. TECH1's status becomes "Payment required" again and the popup reappears. The invoice row still shows `paid` with a refunded amount. |
| A16 | After A15, as TECH1 click Confirm and pay, then pay with 4242. | A **new** Stripe invoice (new number) opens. After paying, status is paid. The invoice list shows both: the refunded one and the new paid one. |
| A16a | Give TECH2 an active TECH seat on tenant A's organisation subscription (`billing.seats`, plan TECH, started today). Sign in as TECH2. | No popup. `/settings/billing` says "Paid by your organisation this month". `GET /me/billing` has `coveredByOrganisation: true`. Remove the seat (billing_end = today): payment is required again. |
| A17 | **Month boundary**: set the TECH1 period in the DB to last month (or test on the 1st, Brisbane time). | A new month means "Payment required" again. The old month's invoice stays `paid` in the list. |
| A18 | **Price change**: publish a new TECH price-book version (for example 5900), effective today. | Users who already have this month's invoice keep paying 4900. A user with no invoice this month sees 5900. |
| A19 | Sign in as TECH2 while the backend is stopped. | Popup reads "Subscription status unavailable" with **Try again** and Log out. Start the backend and click Try again: the normal state returns. |
| A20 | Pay as TECH2 in Chrome, Safari and Firefox. | Each one redirects to Stripe in the same tab (no blocked-popup message). Back returns to the portal. |

---

## B. Stripe webhooks

| ID | Steps | Expected |
| -- | ----- | -------- |
| B1 | `curl -X POST $API/webhooks/stripe -H "Content-Type: application/json" -d '{}'` | `400` (no signature). |
| B2 | Send with a wrong `STRIPE_WEBHOOK_SECRET` (change the env, restart, pay). | `400` in the `stripe listen` log. The invoice does not change. Restore the secret afterwards. |
| B3 | `stripe events resend <invoice.paid evt_id> --api-key …` for an already-processed event. | `200` with `{"status":"duplicate"}`. No change. |
| B4 | Resend an older `invoice.payment_failed` event **after** the invoice is `paid`. | The invoice stays `paid`, because status only moves forward. |
| B5 | `stripe trigger invoice.paid --api-key …`. This creates an invoice FIELD doesn't know about. | `200`, acknowledged and ignored. No FIELD rows change. |
| B6 | After any processed event, check `SELECT stripe_event_id, type FROM billing.stripe_webhook_events ORDER BY id DESC LIMIT 5`. | One row per event id, never duplicated. |
| B7 | Fire any webhook. | Organisation subscriptions and entitlements are unchanged. Webhooks only touch invoice status and totals. |

---

## C. Platform admin billing APIs (no UI yet: curl)

Use OWN's token unless noted.

| ID | Steps | Expected |
| -- | ----- | -------- |
| C1 | `curl $API/admin/billing/organisations -H "Authorization: Bearer $TOKEN"` | `200`, organisations with a billing account or `null`. |
| C2 | Repeat C1–C6 with **TECH1's** token, and with no token. | `403` and `401`. |
| C3 | `POST $API/admin/billing/accounts` with `{"organisationId":"<tenant B id>","name":"Tenant B Pty Ltd","abn":"51 824 753 556","billingEmail":"<your inbox>"}` | `201`. A Stripe Customer appears in the Dashboard. C1 now shows the account. |
| C4 | Repeat C3 for the same organisation. Also try a bad UUID, a missing name and a bad email. | Duplicate: a clear error and no second Stripe customer. Bad input: `400`. |
| C5 | In the Stripe Dashboard, add an AU address to the Tenant B customer. Then `POST $API/admin/billing/test-invoices` with `{"billingAccountId":"<id>","lines":[{"description":"Standard plan — October","quantity":12,"unitCents":2500},{"description":"AI query overage","quantity":1,"unitCents":1990}]}` | `status: "synced"`, `gstCents` and `hostedInvoiceUrl` are filled. Stripe total = 31,990 + GST. The billing email receives the invoice link. |
| C6 | Same as C5 but **without** the customer address. | `502 … customer_tax_location_invalid`. The FIELD invoice is left `final`. |
| C7 | Test invoice with `quantity: 0`, `unitCents: -1` or an empty `lines` array. | `400`. |
| C8 | Pay the C5 invoice with 4242, then `GET $API/admin/billing/invoices/<id>`. | `status: "paid"`, lines listed, `amountPaid` = total. |
| C9 | `GET $API/admin/billing/invoices?page=1&pageSize=25&status=paid`, then `&status=synced`, then `&billingAccountId=<id>`. | Filters and paging work. A bad status or UUID returns `400`. |
| C10 | Refund the C8 payment in Stripe. Fetch the invoice again. | Status stays `paid` with a refunded amount recorded (an admin review case). |

---

## D. Admin subscriptions screen (`/admin/subscriptions`, as OWN)

| ID | Steps | Expected |
| -- | ----- | -------- |
| D1 | Open the page. | Table of organisations with tier, status, billing basis, AI usage and add-ons. |
| D2 | Filter by each status: Active, Expiring soon, Expired, Not set up. | The rows match the filter. |
| D3 | Edit an organisation and set Standard / Per asset with start and end dates. Save. | Row updates. "Per asset · <asset count>". |
| D4 | Set Negotiated with 210 licensed assets, and Fixed fee with a 60-day term. | "Negotiated · 210 assets", "Fixed fee · 60 day". |
| D5 | Set the end date within the expiring-soon window, then in the past. | Status shows "Expiring soon", then "Expired". AI usage shows "— qry" when expired. |
| D6 | Set tier Demo. | AI usage shows "Synthetic data". |
| D7 | Set an end date before the start date, or leave required fields empty. | A validation error. Nothing is saved. |
| D8 | Open `/admin/subscriptions` as TECH1. | Access denied or redirected. |
| D9 | Open `/settings/billing/upgrade`. | Redirects to `/settings/billing`. |

---

## E. Machine lifecycle (decides which machines are billed)

As **ADM** (or OWN). Get machine ids from the Machines page URL.

| ID | Steps | Expected |
| -- | ----- | -------- |
| E1 | `GET $API/machines/<id>/lifecycle` | `registered` for a new machine, the allowed actions, and history. |
| E2 | `POST $API/machines/<id>/lifecycle` `{"action":"activate","reason":"Commissioned"}` | `active`. Billing starts today (the activation day counts). |
| E3 | `{"action":"archive"}` on the active machine, then `{"action":"reactivate"}`. | `archived`, then `active`. Each change is recorded in history with actor, from, to and reason. |
| E4 | `{"action":"deactivate"}` on an active machine. | `registered`. Billing ends on the 1st of next month. |
| E5 | Invalid transitions: `archive` a registered machine, `reactivate` an active one, `"action":"sell"`. | `400` or `409`. State unchanged. |
| E6 | `POST $API/machines/lifecycle/bulk` `{"action":"activate","machineIds":[<3 ids>]}`, then with 201 ids and with duplicates. | Per-machine results. More than 200 ids or duplicate ids returns `400`. |
| E7 | As TECH1 (no `machine.lifecycle`) try E2. | `403`. TECH1 can still `GET` lifecycle (`machine.view`). |
| E8 | Open an **archived** machine's history, configuration, photos and AI chat in the portal. | Identity and summary only. Full features are blocked (`403 machine_inactive`). |
| E9 | `POST $API/machines/<active id>/transfers` `{"receivingOrganisationSlug":"<tenant B slug>","reason":"Sold"}` | Transfer `requested`. It appears in `GET $API/machine-transfers` for A (outgoing) and B (incoming, using TECH3's admin). |
| E10 | As tenant B's admin: `POST $API/machine-transfers/<id>/reject` `{"note":"Not ours"}`. A new request, then cancel it as tenant A. | `rejected` / `cancelled`. The machine stays `active` in tenant A. |
| E10a | New request. As tenant B's admin: `POST $API/machine-transfers/<id>/approve` `{"note":"Bought"}`. | `completed`. Tenant A no longer sees the machine; its billing interval ends on the 1st of next month. Tenant B sees it as `registered` (not billed) with its installed systems and configuration, but **without** A's history, photos, cases, AI chats, fleet/asset number or site. B activates it to start billing. |
| E10b | Approve as tenant A (the seller), approve twice, or approve after A archived the machine. | `404`, then `409 already decided`, then `409 no longer active`. |
| E10c | Tenant B already has a machine with the same serial. Approve. | `409` explaining the serial clash. Nothing moves. |
| E11 | Transfer a non-active machine, or to your own organisation, or to an unknown slug. | `400` or `404`. |
| E12 | `GET $API/machines/<id>/custody` | Chain of custody, including the transfer events. |
| E13 | Activate machines until the Enterprise threshold is reached (see `billing.config`). | Exactly **one** sales review task is created, not one per machine. |

---

## F. Monthly billing run (organisation accounts)

Needs `BILLING_RUN_ENABLED=true` and a restart. The job runs on the hour, so
after each step wait for the next hour (or restart the backend and wait).
Use a billing account from C3 with an ASSET_PRO monthly subscription.

| ID | Steps | Expected |
| -- | ----- | -------- |
| F1 | Activate 3 machines (E2). Wait for a run. | `billing.daily_billable_counts` has a row for every finished day of last month and this month for that account. No row for today. |
| F2 | Change a machine after a day was snapshotted, then wait for a run. | The old day's row is unchanged. Snapshots are never rewritten. |
| F3 | Set the account's activation dates back into last month (or test on the 1st, Brisbane time). Wait for a run. | One draft for last month: `periodStart`/`periodEnd` set, `reviewUntil` = about 24 h later, an ASSET_PRO line at the peak count, with `calcSnapshot`. |
| F4 | Wait for another run. | Still one draft for that month. |
| F5 | `POST $API/admin/billing/invoices/<id>/hold` `{"reason":"Check peak"}`, then let `reviewUntil` pass. | Not finalised while held. Audit log shows who held it and why. |
| F6 | `POST .../release`, then wait for a run. | Finalised: status `synced`, Stripe invoice with GST, due in `PAYMENT_TERMS_DAYS`, billing email received. |
| F7 | Hold an invoice that is already `synced`, or release one that isn't held. | `409`. |
| F8 | Hold or release as a non-admin. | `403`. |
| F9 | Annual account with Q = 15 and a peak of 20. | One ASSET_PRO_OVER_COMMIT line of A$145.83. At or below 15: no invoice at all. |
| F10 | A personal TECH user's account. | Never gets snapshots or monthly drafts. |
| F11 | Leave `BILLING_RUN_ENABLED` unset. | Nothing is snapshotted, drafted or finalised. |

---

## G. Automated suites (run before sign-off)

```sh
cd backend
npx jest src/billing src/machineLifecycle      # pricing T1–T19, seats, sign-up, subscriptions, webhooks, personal payment
npm run test:db -- personalBillingIsolation     # RLS, on a disposable migrated DB only
cd .. && npx vitest run components/billing app/settings
```

Seats, sign-up, annual quotes, Enterprise contracts and the pricing engine
have **no API or screen yet**. The unit suites above are their only coverage.

---

## Out of scope (not built yet: don't test)

Organisation billing overview and usage, payment-method setup and automatic
monthly charging, partner APIs and statements, review queues UI, config and
price-book editor, remote-session billing, overdue reminders, suspension
and credit notes. See [implementationPlan.md](implementationPlan.md).
