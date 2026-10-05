# demoRequests

## Purpose

Demo requests from the marketing site (quiptechfield.com.au). The site's form posts to `POST /public/demo-requests` (no sign-in); each request is saved to `platform.demo_requests`, then the team is emailed (Reply-To the requester) and the requester gets a confirmation. The team follows up by email; the platform administrator (Owner) tracks status and notes on the admin portal's **Demo requests** page via `/admin/demo-requests`.

## Folder structure

```
demoRequests/
├── demoRequests.module.ts             ← ThrottlerModule (this module only) + EmailModule
├── publicDemoRequests.controller.ts   ← POST /public/demo-requests (ThrottlerGuard)
├── adminDemoRequests.controller.ts    ← GET/PATCH /admin/demo-requests, resend-emails (Owner)
├── demoRequests.service.ts            ← honeypot → Turnstile → save → emails in background
├── demoRequestEmails.service.ts       ← sends unsent emails, records *_sent_at
├── turnstileVerifier.service.ts       ← Cloudflare siteverify
├── demoRequests.repository.ts         ← raw SQL, service-role pool
├── demoRequestsConfig.ts / demoRequestsThrottle.ts
├── demoRequestMapper.ts
├── emails/                            ← team + confirmation email (HTML + text)
├── dto/, types/
└── *.spec.ts                          ← DTO, service, Turnstile, HTTP (guards, 429, CORS)
```

## How to run locally

Part of the API. Apply migration `0066_demo_requests.sql`, then `npm run start:dev`. Tests: `npx jest src/demoRequests`.

Try it (dev uses Cloudflare's always-pass test secret, so any token works):

```bash
curl -X POST localhost:4001/public/demo-requests -H 'Content-Type: application/json' \
  -d '{"email":"jo@acme.com","firstName":"Jo","lastName":"Bloggs","company":"Acme","country":"Australia","turnstileToken":"x"}'
```

## Key conventions

- **Request body** (JSON): `email`, `firstName`, `lastName`, `company`, `country`, optional `phone`, `message`, plus `turnstileToken` (the widget's token) and the hidden honeypot `website`. Unknown fields are refused (400). The response is always just `{ "success": true }`.
- **Order:** honeypot (filled → `{ success: true }`, nothing saved) → Turnstile (invalid → 400; Cloudflare unreachable or secret unset → 503) → save → emails. The emails are not awaited: SES failures are logged and leave `team_email_sent_at` / `user_email_sent_at` NULL for **Resend emails**. With `NOTIFICATIONS_ENABLED` off, emails are only logged and also stay NULL.
- **Rate limit:** 5 per IP per hour (`@nestjs/throttler`, in memory, so per API instance). Behind a load balancer set `TRUST_PROXY_HOPS`, or every visitor shares the proxy's IP.
- **CORS:** `/public/*` allows only `PUBLIC_CORS_ORIGINS` (no credentials); every other route keeps `PORTAL_ORIGIN` (`common/security/publicOrigins.ts`).
- **Access:** admin routes need `JwtAuthGuard` + `AdminScopeGuard` + `platform.manage` (Owner). There is no separate super-admin role (retired in 0060).
- **Database:** `platform.demo_requests` is service-role only — tenants can't read leads — so the repository uses `ServiceDatabaseService`.

## Environment variables required

- `TURNSTILE_SECRET_KEY` — Turnstile widget secret; unset = all submissions refused
- `DEMO_NOTIFY_EMAIL` — comma-separated team inboxes
- `PUBLIC_CORS_ORIGINS` — origins allowed on `/public/*`
- `TRUST_PROXY_HOPS` — proxies in front of the API (for the real client IP)
- Uses the email module's `SES_*` and `NOTIFICATIONS_ENABLED`, and the first `PORTAL_ORIGIN` for the link in the team email
