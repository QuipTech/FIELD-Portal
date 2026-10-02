# adminReports

## Purpose

Backs **Settings → Reports & exports**. Quick export builds one of four CSV reports on demand: fleet uptime by site, cases & SLA, AI usage, and the audit log. Scheduled reports save a report, a send time and email recipients. `ScheduledReportsWorker` builds each one when it's due and emails it as a CSV attachment through Amazon SES. Every report covers the last 30 days for every organisation (Owner only, via `AdminScopeGuard`).

## Folder structure

```
adminReports/
├── adminReports.module.ts
├── adminReportExports.controller.ts  ← GET /admin/reports/:reportType/export (CSV)
├── scheduledReports.controller.ts    ← /admin/reports/schedules CRUD + POST /:id/send
├── reportBuilder.service.ts          ← report type → CSV file (shared by export and worker)
├── reports.repository.ts             ← admin_report_* functions (migration 0064)
├── reportsConfig.ts                  ← worker switch (env)
├── csv/                              ← rows → CSV text, case SLA rule
├── schedules/                        ← schedule CRUD, next-run calculation, worker
├── dto/
└── types/
```

## How to run locally

Runs inside the API (`npm run start:dev` in `backend/`). Apply `db/migrations/0064_reports_and_schedules.sql` first. Unit tests: `npx jest src/adminReports`.

Emails go through the shared `EmailService` (`src/email`, see its README for the SES setup).

## Key conventions

- Send times are stored as frequency + day + hour in the schedule's own IANA time zone; `computeNextRunAt` turns that into the next UTC instant, following daylight saving.
- The worker claims one due schedule at a time with `FOR UPDATE SKIP LOCKED`, so several API instances are safe. A failed send is recorded on the schedule (shown as Failed) and isn't retried until the next run; **Send now** sends it again.
- One email per recipient, so recipients don't see each other's addresses.
- Report names go into the subject as an RFC 2047 encoded-word, so a typed name can't add email headers. CSV cells that look like formulas are defused (`src/common/utils/toCsvText.ts`).
- Case SLA targets come from `DashboardConfig` (`SUPPORT_SLA_HOURS_P1/P2/P3`), the same as the dashboard.

## Environment variables required

- `SES_FROM_EMAIL` (see `src/email`) — unset: schedules save but aren't sent (the page says so).
- `SCHEDULED_REPORTS_WORKER_ENABLED` — `false` turns the worker off.
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — only when not running under an IAM role.
