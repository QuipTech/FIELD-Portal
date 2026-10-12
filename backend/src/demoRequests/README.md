# demoRequests

## Purpose

Demo requests from the marketing site (quiptechfield.com.au). The site's form posts to `POST /public/demo-requests` (no sign-in); each request is saved to `platform.demo_requests`, then the team is emailed (Reply-To the requester) and the requester gets a confirmation. The team follows up by email; the platform administrator (Owner) tracks status and notes on the admin portal's **Demo requests** page via `/admin/demo-requests`.

## Folder structure

```
demoRequests/
├── demoRequests.module.ts             ← ThrottlerModule (this module only) + EmailModule
├── publicDemoRequests.controller.ts   ← POST /public/demo-requests (ThrottlerGuard)
├── adminDemoRequests.controller.ts    ← GET/PATCH /admin/demo-requests, resend-emails (Owner)
├── demoRequests.service.ts            ← honeypot → save → emails in background
├── demoRequestEmails.service.ts       ← sends unsent emails, records *_sent_at
├── demoRequests.repository.ts         ← raw SQL, service-role pool
├── demoRequestsConfig.ts / demoRequestsThrottle.ts
├── demoRequestMapper.ts
├── emails/                            ← team + confirmation email (HTML + text)
├── dto/, types/
└── *.spec.ts                          ← DTO, service, HTTP (guards, 429, CORS)
```

## How to run locally

Part of the API. Apply migrations `0066_demo_requests.sql` and `0067_demo_request_user_agent.sql`, then `npm run start:dev`. Tests: `npx jest src/demoRequests`.

Try it:

```bash
curl -X POST localhost:4001/public/demo-requests -H 'Content-Type: application/json' \
  -d '{"email":"jo@acme.com","firstName":"Jo","lastName":"Bloggs","company":"Acme","country":"Australia"}'
```

## Key conventions

- **Request body** (JSON): `email`, `firstName`, `lastName`, `company`, `country`, optional `phone`, `message`, plus the hidden honeypot `website`. Unknown fields (including the old `turnstileToken`) are refused (400). Validation errors come back as `{ "message": ["Enter a valid email address.", …] }` — written for people, since the site shows `message[0]` as-is. Success is always `201 { "ok": true }`.
- **Order:** rate limit (guard, before anything else) → validation → honeypot (filled → `201 { ok: true }`, nothing saved) → save (with IP and User-Agent) → emails. If saving fails, the team email is sent and awaited instead (it's then the only record); if that fails too → 503. Otherwise the emails are not awaited: SES failures are logged and leave `team_email_sent_at` / `user_email_sent_at` NULL for **Resend emails**. With `NOTIFICATIONS_ENABLED` off, emails are only logged and also stay NULL.
- **Rate limit:** 5 per IP per 10 minutes, then 429 (`@nestjs/throttler`, in memory, so per API instance). Behind a load balancer set `TRUST_PROXY_HOPS`, or every visitor shares the proxy's IP.
- **CORS:** `/public/*` allows only `CORS_ALLOWED_ORIGINS` (POST/OPTIONS, `Content-Type`, no credentials); every other route keeps `PORTAL_ORIGIN` (`common/security/publicOrigins.ts`).
- **Access:** admin routes need `JwtAuthGuard` + `AdminScopeGuard` + `platform.manage` (Owner). There is no separate super-admin role (retired in 0060).
- **Database:** `platform.demo_requests` is service-role only — tenants can't read leads — so the repository uses `ServiceDatabaseService`.

## Environment variables required

- `DEMO_REQUEST_NOTIFY_TO` — comma-separated sales inboxes (`DEMO_NOTIFY_EMAIL` still read as a fallback)
- `CORS_ALLOWED_ORIGINS` — origins allowed on `/public/*` (`PUBLIC_CORS_ORIGINS` still read as a fallback)
- `TRUST_PROXY_HOPS` — proxies in front of the API (for the real client IP)
- Uses the email module's `SES_FROM_EMAIL`, `SES_FROM_NAME`, `SES_REGION`/`AWS_REGION` and `NOTIFICATIONS_ENABLED=true` (Amazon SES), and the first `PORTAL_ORIGIN` for the link in the team email
