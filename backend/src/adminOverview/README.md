# adminOverview

## Purpose

`GET /admin/overview` returns the admin portal's Overview page in one request, for the caller's admin scope: every organisation for the Owner (the platform administrator).

- **Stat cards:** active and invited users; indexed documents and the share of uploaded pages that are searchable; registered machines, how many models they use, and how many sites they're at.
- **Ingestion queue:** documents indexing, queued, failed or awaiting review.
- **Latest admin actions:** the newest audit-log changes, without sign-ins.

## Folder structure

```
adminOverview/
├── adminOverview.controller.ts / adminOverview.service.ts / adminOverview.module.ts
├── adminOverview.repository.ts  ← admin_overview_summary / admin_overview_ingestion_queue (migration 0058)
├── adminOverviewMapper.ts       ← rows → response (same document states as the Knowledge screen)
└── types/
```

## How to run locally

Runs inside the API. Needs migration `0058_admin_overview.sql`. Unit tests: `npx jest src/adminOverview`.

## Key conventions

- **Document figures:** they count what the organisation's technicians can search: their own documents plus the shared library.
- **Ingestion queue:** an Owner's queue lists only their own organisation's documents, because they can't act on shared ones.
- **Latest actions:** they reuse `AuditLogService`, so they follow the same scope rules as the Audit log screen.

## Environment variables required

None.
