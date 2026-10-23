# Billing implementation

## Confirmed override

The user confirmed on 20 October 2026 that **every non-Owner**, including
invited organisation members and support staff, pays for a personal monthly
TECH subscription. Owner is the existing platform role. Organisation payment
does not exempt members. This overrides section 5's no-seat-charge rule.
The requested pay-on-login flow collects the current calendar month's charge
up front, overriding TECH billing in arrears. Amounts remain AUD ex GST and
come from the versioned TECH price book (initially 4900 cents).

## Delivery order and existing work

1. Audit/config/pricing: extend existing billing.config, platform.plans,
   billing.price_books and billing.price_bands; preserve existing pricing tests.
2. Accounts/subscriptions/seats: extend the existing services and tables.
   Personal payment uses separate accounts so users never pay an organisation's
   invoice or view another user's billing. No existing commercial data moves.
3. Lifecycle: existing machineLifecycle services and activation intervals;
   integrate the portal with existing APIs and keep transfer approval separate.
4. Entitlements: extend the existing resolver and feature checks.
5. Usage: append-only events, ingestion/storage/AI integration, remote APIs.
6. Allowances: pooled metrics, notification thresholds and review tasks.
7. Daily snapshots: account-local days, advisory locks, backfill API.
8. Invoices: calculation snapshots, review/finalisation, payment method setup.
9. Partners: agreements, scoped API and statements.
10. Collections: overdue notifications, audited suspension.
11. Assisted onboarding: one-off invoicing and audited waivers.
12. Organisation/admin/partner screens and documented API contracts.

## First implementation: personal payment flow

New tables: billing.personal_accounts and billing.personal_periods, with
user/tenant ownership, standard audit columns, RLS and service-only writes.
Reused tables: billing.billing_accounts, billing.price_books,
billing.invoices, billing.invoice_lines and audit_logs. No changes to existing
organisation subscriptions, no duplicate Stripe client or webhook processor.

Backend files: personalSubscription types, repository, service, controller,
invoice preparation service and tests; migration 0098; billing.module.ts;
stripe.service.ts for Australian billing-address updates.
Portal files: personalBillingApi.ts, personalBilling.ts, usePersonalBilling.ts,
payment dialog, global login-aware payment prompt and personal billing view;
app/layout.tsx, settings/billing/page.tsx and sideNav.tsx.
Existing route updated: /settings/billing. No remote-session UI.

API contract is written in BILLING_API.md before portal integration. Tests
cover role exemptions, account/user isolation, retries, payment confirmation,
calendar boundaries, refunds, display currency and prompt behavior.

## Remaining specification work

The personal payment flow does not implement packages 4–12 above in full.
The API contract distinguishes shipped endpoints from planned work. Do not
represent the entire billing specification as complete until all packages
and acceptance tests have passed.
