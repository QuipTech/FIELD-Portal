# Stripe setup (test mode)

The personal TECH payment flow is documented in
[`../docs/billing/BILLING_OPERATIONS.md`](../docs/billing/BILLING_OPERATIONS.md).
Apply migration `0098_personal_subscriptions` before using `/me/billing`.
Non-Owners confirm the current month's payment from the portal; Owners are
exempt. Personal invoices use the same webhook and Stripe invoice integration
described below. The portal now collects an Australian billing address, so
personal Customers do not need the manual address step used by test invoices.

FIELD calculates every amount itself. Stripe only presents the invoice, adds
GST and collects payment. Charges go to Stripe as **Invoice Items on a Stripe
Invoice**: no Subscriptions, Prices or Checkout. Currency is AUD and every
amount is in integer cents.

Everything below uses **test mode**. The backend refuses to start with a live
key (`sk_live_…`) unless `NODE_ENV=production`, and it logs the active mode on
startup (`Stripe mode: test; tax on`).

## 1. Test keys

1. Sign in at <https://dashboard.stripe.com>. There's no "Test mode" toggle
   at the top right any more. Open the **account menu** (company name, top
   left) → **Sandboxes**, then open a sandbox or **Create sandbox** (e.g.
   "FIELD dev"). Some accounts show **Switch to test mode** in that menu
   instead.
2. Make sure the Dashboard shows the Sandbox / Test mode banner, because the
   view without it is the **live** account. Do every step in this guide inside
   the sandbox.
3. Go to **Developers → API keys** and copy the **Secret key**. It must start
   with `sk_test_`.
4. Put it in `backend/.env.development` (or `.env.staging`):

   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...   # from step 3 or 4 below
   STRIPE_TAX_ENABLED=true
   ```

   Leave the `.env.production` values empty until go-live.

## 2. Stripe Tax for Australia (GST 10%)

1. In test mode, go to **Settings → Tax** (or **More → Tax**) and click
   **Get started**.
2. Set the **origin address** to QuipTech's Australian business address.
3. Under **Registrations**, add **Australia → GST**. Stripe then charges 10%
   GST to Australian customers.
4. Leave the default tax code as "General – Electronically Supplied Services"
   (`txcd_10000000`), or set "Software as a service".
5. Leave `STRIPE_TAX_ENABLED=true`. Invoices are then created with
   `automatic_tax.enabled = true`. Items are sent tax-exclusive, so GST is
   added on top of FIELD's amounts.

**Customer address:** Stripe Tax needs to know where each customer is. FIELD
doesn't send an address yet, so before the first test invoice, open the
customer in **Customers** and add an Australian billing address. If you skip
this, the invoice call fails with a 502 like `Stripe: … (customer_tax_location_invalid)`,
and the FIELD invoice is left in status `final`. To test without tax, set
`STRIPE_TAX_ENABLED=false`; GST then comes out as 0.

## 3. Webhook endpoint (staging)

1. Go to **Developers → Webhooks → Add endpoint**.
2. Set the endpoint URL to `https://<staging-api-host>/webhooks/stripe`.
3. Select these events:
   - `invoice.finalized`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `charge.refunded`
4. Save, then reveal the **Signing secret** (`whsec_…`) and set
   `STRIPE_WEBHOOK_SECRET` in `.env.staging`.

The old `/billing/stripe/webhook` endpoint has been removed. Delete any
Dashboard endpoint that still points at it.

Webhooks only update a FIELD invoice's status and totals. Each event id is
saved once (`billing.stripe_webhook_events`), so a redelivered event returns
200 and is skipped.

## 4. Local testing with the Stripe CLI

```sh
brew install stripe/stripe-cli/stripe
stripe login
stripe listen \
  --events invoice.finalized,invoice.paid,invoice.payment_failed,charge.refunded \
  --forward-to localhost:4001/webhooks/stripe
```

Newer CLI versions refuse to forward without `--events`. If `stripe login`
picked a different sandbox from the one `STRIPE_SECRET_KEY` belongs to, add
`--api-key <that key>` so the listener sees the backend's events.

`stripe listen` prints a `whsec_…` secret. Put it in
`.env.development` as `STRIPE_WEBHOOK_SECRET` and restart the backend. Keep
`stripe listen` running while you test. You can replay an event with
`stripe events resend <evt_id>`, which should come back as `{"status":"duplicate"}`.

Run the tests with `npx jest src/billing`.

## 5. Test cards

Open the invoice's `hostedInvoiceUrl` and pay with:

| Card                  | Result                    |
| --------------------- | ------------------------- |
| `4242 4242 4242 4242` | Succeeds → invoice `paid` |
| `4000 0000 0000 9995` | Declined (insufficient funds) → `payment_failed` |
| `4000 0025 0000 3155` | Asks for 3D Secure, then succeeds |

Use any future expiry date, any CVC and any postcode.

## 6. Example requests

Every `/admin/billing/*` route needs a platform administrator's access token
(Owner with `platform.manage`); anyone else gets 403.

```sh
API=http://localhost:4001
TOKEN=<platform admin access token>

# Organisations with their billing account (null if none)
curl -s "$API/admin/billing/organisations" -H "Authorization: Bearer $TOKEN"

# Billing account + Stripe Customer for an organisation
curl -s -X POST "$API/admin/billing/accounts" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"organisationId":"<tenant uuid>","name":"Acme Mining Pty Ltd","abn":"51 824 753 556","billingEmail":"accounts@acme.example"}'

# Test invoice: saved, pushed to Stripe, finalised, emailed
curl -s -X POST "$API/admin/billing/test-invoices" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"billingAccountId":"<account uuid>","lines":[{"description":"Standard plan — October","quantity":12,"unitCents":2500},{"description":"AI query overage","quantity":1,"unitCents":1990}]}'

# Invoices (paged, optional filters)
curl -s "$API/admin/billing/invoices?page=1&pageSize=25&status=synced" -H "Authorization: Bearer $TOKEN"

# One invoice with its lines
curl -s "$API/admin/billing/invoices/<invoice uuid>" -H "Authorization: Bearer $TOKEN"

# Webhook (normally Stripe or `stripe listen`; an unsigned call gets 400)
curl -s -X POST "$API/webhooks/stripe" -H "Content-Type: application/json" -d '{}'
```

## End-to-end check

1. Create a billing account, then add an AU address to its customer in the
   Dashboard (see the note in section 2).
2. Create a test invoice. The response should have `status: "synced"`,
   `gstCents` and a `hostedInvoiceUrl`, and the billing email should receive
   the link.
3. Pay at the link with `4242 4242 4242 4242`.
4. `GET /admin/billing/invoices/<id>` should now show `status: "paid"`.
