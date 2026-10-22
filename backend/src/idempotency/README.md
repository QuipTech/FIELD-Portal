# idempotency

## Purpose

Server side of the mobile app's offline write queue (outbox). The app gives each queued write a unique `Idempotency-Key` header (a UUID) and resends it until it gets an answer. The first successful response is saved and every retry with the same key gets that response back, so a write is never applied twice, even when the network drops after the server committed it.

Applied to:
- `POST /machines/:machineId/history`
- `POST /machines/:machineId/history/:entryId/photos`
- `POST /cases/:caseNumber/messages` (also `/support-cases/…`)
- `POST /admin/cases/:caseNumber/messages`

## Folder structure

```
idempotency/
├── idempotency.interceptor.ts   ← claim → run → save response, or replay; frees the key on failure
├── idempotency.repository.ts    ← idempotency_keys SQL (claim, complete, release)
└── idempotency.http.spec.ts     ← the interceptor end to end with an in-memory store
```

## How to run locally

Runs inside the API after migration `0106`. Tests: `npx jest src/idempotency`; database: `npm run test:db -- test/appSync.db-spec.ts`.

## Key conventions

- Keys are per user, 8–100 characters of `A-Z a-z 0-9 _ . : -`. Without the header a route behaves as before.
- A key reused for a different request (method + path) is 422. A retry while the first attempt is still running is 409; retry shortly after.
- A failed attempt (any error) frees the key, so the outbox can retry. A claim stuck for 2 minutes (crashed request) can be reclaimed.
- A replayed photo response carries the signed URL from the first attempt, which expires after 15 minutes; reload the entry to refresh it.
- To add a route: `@UseInterceptors(IdempotencyInterceptor)` after `JwtAuthGuard`.

## Environment variables required

None beyond the API's own (`DATABASE_URL`).
