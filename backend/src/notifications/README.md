# notifications

## Purpose

The signed-in user's in-app notifications: the portal's bell (live badge and dropdown) and the `/notifications` screen. This module reads rows, marks them read, and pushes new ones live over Socket.IO. Rows are written by database triggers (migration `0054_user_notifications.sql`) and by the alert engine (`src/alertEngine`, kind `alert`).

## Folder structure

```
notifications/
├── notifications.controller.ts  ← GET /notifications, GET /unread-count, POST /:id/read, POST /read-all
├── notifications.service.ts     ← paging (`before` cursor), read state
├── notifications.repository.ts  ← raw SQL, always filtered to the caller
├── notifications.gateway.ts     ← Socket.IO /notifications: token-checked, one room per user
├── notificationListener.service.ts ← LISTEN user_notification → emit to the user's room
├── notificationEvents.ts        ← room name, event name, Postgres channel
├── notifications.module.ts
├── dto/, types/
```

## How to run locally

Runs inside the API (`npm run start:dev` in `backend/`). Needs migrations `0053`, `0054` and `0065` (the `pg_notify` trigger behind the live bell).

## Key conventions

- **Adding an event:** write a trigger that calls `notify_users(recipients, exclude, kind, title, body, link)`, and add the new kind to the table's CHECK constraint and to `NotificationKind`.
- **Who did it:** the person who made a change is never notified about it. For writes made on a user's behalf, use `DatabaseService.withActor(actor, …)` instead of `withTenant` so the triggers know who that is.
- **Live updates:** a trigger on `notifications` (migration 0065) calls `pg_notify`; each API instance LISTENs on one dedicated connection and emits `notification:new` to that user's room only. The portal then refetches over REST, so the socket never carries notification content.

## Environment variables required

`DATABASE_URL` (the listener's connection), `JWT_SECRET` (socket auth).
