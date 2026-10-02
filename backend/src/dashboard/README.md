# dashboard

## Purpose

Serves the portal's Dashboard screen in one request (`GET /dashboard`), scoped to the caller's organisation. It returns:

- **Open cases:** by priority, plus how many are past their SLA target.
- **Machines down**
- **Entries this week:** all, and the caller's own.
- **Fleet uptime:** last 8 weeks, from `machine_status_events`.
- **Recent activity:** cases, history entries, the caller's AI threads, and new live documents.
- **My machines:** machines the caller has worked on, down ones first.

## Folder structure

```
dashboard/
├── dashboard.controller.ts / dashboard.service.ts / dashboard.module.ts
├── dashboardConfig.ts            ← SLA targets per priority (env)
├── dashboardCounts.repository.ts ← open cases, machines down, entries this week
├── fleetUptime.repository.ts     ← status events in the 8-week window
├── computeFleetUptime.ts         ← weekly uptime from status events (pure, tested)
├── myMachines.repository.ts      ← machines the caller has worked on
├── recentActivity.repository.ts  ← newest cases / entries / threads / documents
├── recentActivityMapper.ts       ← rows → activity items, merged by time
└── types/
```

## How to run locally

Runs inside the API (`npm run start:dev` in `backend/`). Needs migration `0053_machine_status_events.sql`. Unit tests: `npx jest src/dashboard`.

## Key conventions

- **Uptime:** the share of tracked machine-time not spent `down`; `service_due` counts as up. Weeks run Monday to Monday, UTC. Weeks before tracking began are `null`, not 0%.
- **Status history:** recorded only by a database trigger on `machines`. Change a status through `PATCH /machines/:id/status`, which audits the change and records who made it.
- **Shared-library documents:** they have no `tenant_id`, so they're read outside RLS with explicit tenant filters, like knowledge search.

## Environment variables required

`SUPPORT_SLA_HOURS_P1`, `SUPPORT_SLA_HOURS_P2`, `SUPPORT_SLA_HOURS_P3` (optional; defaults 4 / 24 / 72).
