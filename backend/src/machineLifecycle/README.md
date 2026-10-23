# Machine lifecycle (`src/machineLifecycle`)

## Purpose

Decides whether a machine is billed (FIELD billing spec section 4). Every
machine keeps its permanent id and is registered, active, archived or sold.
Only active machines count toward the month's peak, through activation
intervals on the billing account. Inactive machines show identity and
summary only; full history, configuration, photos and new AI threads need
an active machine. Transfers move a machine between organisations with the
receiving organisation's approval.

## Folder structure

```
machineLifecycle/
├── lifecycleTransitions.ts        ← pure: states, the 5 transitions, billing days, available actions
├── machineLifecycle.service.ts    ← activate/deactivate/archive/reactivate, bulk, lifecycle history
├── machineLifecycle.controller.ts ← /machines/:id/lifecycle, /machines/lifecycle/bulk, /machines/:id/custody
├── machineActivations.repository.ts ← peak-rule count, billing.apply_machine_transition()
├── enterpriseThreshold.service.ts ← one sales review task at the Enterprise threshold (T8)
├── organisationBillingAccount.service.ts ← self-serve: first activation creates the organisation's billing account
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
  default billing time zone (audited; Stripe customer created if Stripe is
  configured). A user's personal TECH account is separate and never used.
  Platform admins can also set one up first at Admin → Billing accounts.
- A suspended account can't activate or reactivate; it can still
  deactivate, archive and read everything.
- Reaching `ENTERPRISE_THRESHOLD_MACHINES` never refuses an activation.
- Transfer approval (which moves the machine's records) is not built yet:
  the list of records that move and stay needs sign-off first.

## Environment variables required

None beyond the API's database settings.
