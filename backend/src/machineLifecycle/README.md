# Machine lifecycle (`src/machineLifecycle`)

## Purpose

Decides whether a machine is billed (FIELD billing spec section 4). Every
machine keeps its permanent id and is registered, active, archived or sold.
Only active machines count toward the month's peak, through activation
intervals on the billing account. Inactive machines show identity and
summary only; full history, configuration, photos and new AI threads need
an active machine. Documents are the exception: open in every state, and
read-only once sold (`machineHistory/machineDocuments.*`). Transfers move a machine between organisations with the
receiving organisation's approval.

## Folder structure

```
machineLifecycle/
├── lifecycleTransitions.ts        ← pure: states, the 5 transitions, billing days, available actions
├── machineLifecycle.service.ts    ← activate/deactivate/archive/reactivate, bulk, lifecycle history
├── machineLifecycle.controller.ts ← /machines/:id/lifecycle, /machines/lifecycle/bulk, /machines/:id/custody, deletion
├── machineDeletionRules.ts        ← pure: when a machine may be deleted, and its days-used final charge
├── machineDeletion.service.ts     ← GET /machines/:id/deletion-check, POST …/final-charge, DELETE /machines/:id (soft delete, audited)
├── machineActivations.repository.ts ← peak-rule count, billing.apply_machine_transition()
├── enterpriseThreshold.service.ts ← one sales review task at the Enterprise threshold (T8)
├── organisationBillingAccount.service.ts ← self-serve: first activation signs up the organisation (account + monthly ASSET_PRO)
├── activationQuote.service.ts     ← GET /machines/lifecycle/activation-quote: price shown before activating
├── activationQuote.ts             ← pure: this month's charge before/after, band crossing
├── activeMachine/                 ← RequireActiveMachineGuard + the shared active check (403 machine_inactive)
├── transfers/                     ← transfer requests, approval (moves the machine), approvals inbox, chain of custody
└── dto/                           ← request validation
```

## How to run locally

Part of the API (`npm run start:dev` from `backend/`). Tests:
`npx jest src/machineLifecycle`.

## Key conventions

- Transition rules and billing days are worked out in TypeScript
  (`lifecycleTransitions.ts`); `billing.apply_machine_transition()` applies
  them atomically and only if the machine is still in the expected state.
- billing_end is the first day of the month after leaving active; the
  activation day counts. Days are in the billing account's time zone.
- Changes need `machine.lifecycle` (Organisation Admin, Owner). Each one is
  audited with actor, from, to and reason, in the same transaction.
- An organisation with no billing account gets one on its first activate /
  reactivate: the organisation's name, the activating admin's email, the
  default billing time zone and a monthly ASSET_PRO subscription (audited;
  Stripe customer created if Stripe is configured). An account without a
  machine plan (ASSET_PRO, ENTERPRISE or INTERNAL) gets the monthly ASSET_PRO
  subscription on its next activation. Without it the monthly run would
  never charge for the machines.
- Activation takes no payment. Machines are billed monthly in arrears on
  the month's peak (spec sections 3 and 9). The activation dialog shows the
  rate, the new monthly charge and the invoice date from the activation quote. A user's personal TECH account is separate and never used.
  Platform admins can also set one up first at Admin → Billing accounts.
- A suspended account can't activate or reactivate; it can still
  deactivate, archive and read everything.
- Reaching `ENTERPRISE_THRESHOLD_MACHINES` never refuses an activation.
- Deleting needs `machine.lifecycle` and is a soft delete. The machine must be
  out of active with no open cases or pending transfer. Every monthly invoice
  already issued must be paid. On a monthly plan the month still open, and last
  month if the run hasn't invoiced it, are paid at once: POST
  `/machines/:id/final-charge` raises one `machine_final` invoice with a line per
  month, each monthly rate × days used ÷ days in the month, counted to the day it
  was deactivated at the band for that month's peak. The machine then leaves
  those months' peaks (spec section 3, rule 3a) and can't be reactivated in the
  month still open. The same call returns a Stripe Checkout URL for the total
  (`paymentUrl`): Checkout asks for the billing address (saved on the customer,
  so Stripe Tax can add GST), creates the paid Stripe invoice itself, and comes
  back to `/machines/:id?payment=complete`. A machine_final invoice is never
  pushed as a Stripe invoice too (the hourly retry skips it). Stripe's errors
  reach the caller; the invoice stays saved and calling again retries. The
  deletion check asks Stripe about unpaid invoices and Checkout sessions, so a
  payment counts before its webhook arrives. Annual plans wait for the month-end run; Enterprise
  and internal plans have no machine charge. Deleting disconnects its machine app
  and frees its serial to register again; intervals and invoices stay.
- Transfer approval (which moves the machine's records) is not built yet:
  the list of records that move and stay needs sign-off first.

## Environment variables required

None beyond the API's database settings.
