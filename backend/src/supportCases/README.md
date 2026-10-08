# supportCases

## Purpose

Support cases with one shared chat thread per case. A customer raises a case for their organisation; QuipTech support staff work it from the admin portal. The customer, the assigned support person and any admin all write in the same thread; staff can also leave internal notes that customers never receive. Assignment, status and priority changes appear in the thread as system lines (`case_events`) and in the case organisation's audit log.

| Who                      | Holds             | May                                                                                         |
| ------------------------ | ----------------- | ------------------------------------------------------------------------------------------- |
| Customer                 | `support.create`  | Raise, read and reply on their own organisation's cases; reopen within 7 days of resolution |
| Assignee (Support Agent) | `support.agent`   | Read and work only the cases assigned to them: reply, internal notes, change status         |
| Admin (Owner)            | `platform.manage` | Every case in every organisation: assign, status, priority, reply, notes, resolve, close    |

Every rule lives in `caseAccessPolicy.ts` and is enforced by the API (and the database where it can be), not by hiding buttons. A case outside the caller's reach is `404`, never `403`.

## Folder structure

```
supportCases/
├── supportCases.controller.ts        ← customer: /cases (also /support-cases, the mobile app's path)
├── adminSupportCases.controller.ts   ← staff: /admin/cases, /admin/staff
├── caseAccessPolicy.ts               ← who may see/do what, status rules (pure, tested)
├── caseAccess.service.ts             ← finds a case in any organisation, resolves the caller's role
├── supportStaff.guard.ts             ← /admin routes: support staff only; @CurrentSupportStaff()
├── supportCases.service.ts           ← customer: list, get, create, reopen
├── caseMessages.service.ts           ← customer: thread (no internal notes), replies, uploads, read marks
├── adminSupportCases.service.ts      ← staff: queue, stats, staff list, case detail, thread
├── adminCaseUpdates.service.ts       ← staff: PATCH (assign/status/priority), replies + notes, uploads
├── buildCasePatch.ts                 ← what a PATCH changes + its thread lines (pure, tested)
├── postMessageToCase.ts              ← the one way a message joins a thread
├── recordCaseChange.ts               ← case_events rows + audit entry, same transaction
├── caseAttachments.service.ts        ← S3 upload (cases/{tenantId}/…) and signed URLs
├── caseAnnouncer.service.ts          ← after commit: socket pushes + emails
├── caseEmailNotifier.service.ts      ← staff reply → customer, customer reply → assignee
├── caseEventsPublisher.ts            ← socket rooms; internal notes only to the staff room
├── caseRealtime.gateway.ts           ← Socket.IO /support-cases (join, leave, typing)
├── caseAutoClose.worker.ts           ← hourly: close cases resolved 7+ days ago
├── *.repository.ts                   ← SQL; people via support_case_person()
├── dto/, types/
└── *.spec.ts, supportCaseTestRows.ts, supportCasesFakeDatabase.ts ← tests and their fixtures
```

## How to run locally

Runs inside the API (`npm run start:dev` in `backend/`) after migrations `0069`–`0072`. Unit and HTTP tests: `npx jest src/supportCases`. Database tests (real RLS, rolled back): `npm run test:db`.

To make someone support staff, give them the **Support Agent** role (or Owner for an admin) on the admin Users page.

## Key conventions

- **Cross-organisation access:** staff requests look the case up with `support_case_tenant_id()`, decide the role in `caseAccessPolicy`, then run everything under the case's own tenant (`withTenant` / `withActor`), so RLS still applies and the audit entry lands in that organisation's log. The queue's lists are SECURITY DEFINER functions (`0071`) that take `p_only_assignee` for agents.
- **Internal notes:** filtered in SQL (`includeInternal`), emitted only to the `case:N:staff` socket room, never emailed, and the in-app notification trigger skips the customer. A database CHECK refuses an internal note from a customer.
- **Status rules:** assigning a `new` case opens it; unassigning an `open` one makes it `new`; a customer reply turns `waiting_on_customer` back into `open`. The SLA clock, `resolved_at` and `closed_at` follow the status in a database trigger (`0069`).
- **Every change** (assign, status, priority, reopen) writes `case_events` + an audit entry through `recordCaseChange`.
- **Attachments:** upload first (`POST /cases/attachments` or `/admin/cases/:n/attachments`), then send the ids in `attachmentIds`; only the uploader's own unsent files can be attached.

## Environment variables required

- `SUPPORT_SLA_HOURS_P1`, `SUPPORT_SLA_HOURS_P2`, `SUPPORT_SLA_HOURS_P3` — response targets (defaults 4 / 24 / 72)
- `SUPPORT_CASE_AUTO_CLOSE_ENABLED` — `false` stops the auto-close job
- Email: `SES_FROM_EMAIL`, `SES_FROM_NAME`, `SES_REGION`/`AWS_REGION`, `NOTIFICATIONS_ENABLED=true`, `PORTAL_ORIGIN` (links)
- Attachments: `S3_PORTAL_STORAGE_BUCKET`, `AWS_REGION` (IAM needs `s3:PutObject`/`GetObject` on `cases/*`)
- Realtime: `JWT_SECRET` (socket auth), `PORTAL_ORIGIN` (socket CORS)
