# QuipTech FIELD — Portal Backend

## Purpose

This is the backend API for the QuipTech FIELD Portal — a NestJS service that
backs the User Portal and Admin Console frontend at `portal/`. The full
Phase 1 database schema (multi-tenant, RLS-enforced) lives under
`db/migrations/`. Sign-up and sign-in go through Amazon Cognito; `src/auth/`
exchanges the Cognito login for a FIELD session.

## Folder structure

```
backend/
├── src/
│   ├── app.controller.ts   ← root controller (scaffold placeholder)
│   ├── app.module.ts       ← root module, wires Config/Database/Auth
│   ├── app.service.ts      ← root service (scaffold placeholder)
│   ├── main.ts             ← app bootstrap entry point (CORS, ValidationPipe)
│   ├── database/
│   │   ├── database.module.ts   ← global module exporting DatabaseService
│   │   └── database.service.ts  ← pg Pool wrapper; transaction()/withTenant()
├── certs/
│   └── rdsGlobalBundle.pem   ← AWS's public RDS CA bundle (not a secret)
│   ├── common/
│   │   ├── security/       ← passwordHasher.ts, tokenHasher.ts
│   │   └── utils/          ← slugify.ts
│   └── auth/
│       ├── auth.module.ts / auth.controller.ts / auth.service.ts
│       ├── auth.repository.ts    ← raw SQL, one query per function
│       ├── authToken.service.ts  ← access/refresh JWT signing & verification
│       ├── authRegistration.ts   ← self-serve tenant + owner signup flow
│       ├── authSessionIssuer.ts  ← creates/rotates a session, signs tokens
│       ├── uniqueTenantSlug.ts   ← slug collision handling
│       ├── cognitoAuth.controller.ts / cognitoAuth.service.ts
│       │                         ← POST /auth/sync (Google/Apple via Cognito)
│       ├── cognito/              ← Cognito ID token verification + claim mapping
│       ├── dto/, types/, strategies/, guards/, decorators/
│   ├── storage/              ← StorageModule (global): all S3 access
│   │   ├── storage.service.ts    ← uploadDocument / uploadMachinePhoto /
│   │   │                           uploadAvatar, getSignedDownloadUrl, deleteFile
│   │   ├── storageFileRules.ts   ← per-folder types, size limits, signature check
│   │   └── storageKeys.ts        ← key layout + tenant-prefix delete boundary
│   ├── knowledge/            ← shared knowledge-document query, mapper, rules
│   ├── documents/            ← /documents — an organisation's own documents
│   ├── machineHistory/       ← /machines/:id — history entries + photos
│   ├── adminKnowledge/       ← /admin/knowledge — shared library (Owner only)
│   ├── machineLibrary/       ← /admin/machineModels — model system/component trees (Owner only)
│   ├── adminAi/              ← /admin/ai — AI usage, prompt versions, review queue (Owner only)
│   ├── adminAuditLog/        ← /admin/auditLog — every organisation's audit events + CSV (Owner only)
│   ├── adminSubscriptions/   ← /admin/subscriptions — each organisation's subscription (Owner only)
│   ├── organisationBranding/ ← /organisation/branding — the caller's own organisation's branding
│   ├── organisationNotifications/ ← /organisation/notifications — alert rules + delivery channels (Owner)
│   ├── organisationSubscription/ ← GET /organisation/subscription — the caller's plan, or Free
│   ├── supportCases/         ← /support-cases REST + Socket.IO gateway (live case chat)
│   ├── machineFleet/         ← GET/POST /machines (the Machines list), GET /machine-catalog
│   ├── knowledgeLibrary/     ← GET /knowledge/library — the Knowledge screen's search
│   ├── dataGovernance/       ← dataSchemas.config.ts: the platform/app/billing split (page + DB test)
│   ├── adminDataRetention/   ← /admin/settings/data-retention + nightly AI log purge job
│   ├── billing/              ← the ONLY Stripe code: webhook → app.subscriptions/entitlements
│   ├── entitlements/         ← feature checks, read from app.entitlements only
│   ├── myData/               ← /me/data-export, /me/deletion-request + export worker
│   └── users/
│       ├── users.module.ts / users.service.ts  ← findOrCreateFromCognito
│       ├── userProfile.service.ts ← PATCH /users/me, POST /users/me/avatar
│       ├── cognitoSignup.ts      ← new tenant + Customer for first-time Google/Apple users
│       ├── users.controller.ts / accountDeletion.service.ts
│       │   / cognitoUserDeletion.service.ts
│       │                         ← DELETE /users/me (self-service; the last Owner is refused),
│       │                            GET /users/me/deletion-eligibility
│       └── users.repository.ts   ← Cognito lookup/link + account deletion queries
├── db/
│   └── migrations/          ← numbered SQL migrations, applied in order
│       ├── 0001_init.sql
│       ├── 0002_extensions_and_app_role.sql
│       └── …                 ← see db/migrations/README below
├── test/                   ← e2e test config
├── .env.development        ← local development environment values
├── .env.staging             ← staging environment values
├── .env.production          ← production environment values
├── nest-cli.json
└── tsconfig.json
```

## How to run locally

```bash
cd backend
npm install
npm run start:dev
```

Applies `.env.development` by default (`NODE_ENV` defaults to `development`
in `app.module.ts`). To run against staging or production config locally,
set `NODE_ENV` before starting, e.g. `NODE_ENV=staging npm run start:dev`.

The API listens on `PORT` (4001 in dev) and accepts CORS requests from
`PORTAL_ORIGIN` (the Next.js portal, `http://localhost:3001` in dev).

### Running migrations

Each environment is a separate database (`quiptech_dev`, `quiptech_staging`,
`quiptech_prod`) on the same shared RDS instance. Apply migrations in order
with `psql`, sourcing the matching env file first:

```bash
set -a; source .env.development; set +a
for f in db/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

Swap `.env.development` for `.env.staging` / `.env.production` to target the
other databases. Every migration is idempotent (`IF NOT EXISTS`, `ON
CONFLICT DO NOTHING`, guarded `DO $$ … $$` blocks), so re-running the whole
set is safe.

**Before deploying past local dev**, rotate the placeholder password created
in `0002_extensions_and_app_role.sql`:

```sql
ALTER ROLE field_app WITH PASSWORD '<a real generated secret>';
```

then point that environment's `DATABASE_URL` at `field_app` instead of
`postgres` — the app should never run as the migration/superuser role
outside local dev.

## Key conventions specific to this app

- Follows the root `CLAUDE.md` NestJS suffix conventions: `<name>.module.ts`,
  `<name>.controller.ts`, `<name>.service.ts`, `<name>.guard.ts`.
- Independent app with its own `package.json`, nested inside `portal/` —
  not part of a monorepo/workspace.
- `AppModule` loads `@nestjs/config` globally with
  `envFilePath: .env.${NODE_ENV}`, so which `.env.*` file is read is
  controlled entirely by `NODE_ENV` — no manual switching in code.
- Schema changes are additive, numbered migration files under
  `db/migrations/` (`0002_*.sql`, `0003_*.sql`, …) rather than one
  ever-growing schema file, and must be safe to re-run.
- No ORM — raw `pg` queries via `DatabaseService`, matching the raw-SQL
  migration convention already established in this app. Every tenant-scoped
  query runs inside `DatabaseService.withTenant(tenantId, …)`, which sets
  `app.tenant_id` for that transaction so PostgreSQL RLS does the actual
  tenant isolation — the query itself never needs a manual `WHERE tenant_id
  = …`.
- The backend never sees passwords: Cognito stores and checks them
  (`users.password_hash` is only set on accounts from before the move to
  Cognito, and nothing reads it for sign-in). Refresh tokens are signed JWTs; only their SHA-256 digest is
  stored (`sessions.refresh_token_hash`), so a leaked database dump can't be
  replayed as a live session.
- `DATABASE_URL` uses `sslmode=verify-full`, and Node doesn't ship Amazon's
  RDS CA in its trust store — `DatabaseService` strips `sslmode` out of the
  connection string and supplies `certs/rdsGlobalBundle.pem` as the `ssl.ca`
  explicitly instead. This isn't optional: `pg` gives a `sslmode` found in
  the connection string priority over an `ssl` option passed alongside it,
  so if both are present the explicit CA is silently ignored and you get
  `self-signed certificate in certificate chain`.

## Cognito sign-in (email/password, Google, Apple)

Every user signs up and signs in through Cognito; the backend has no
password endpoints of its own. Email/password accounts live in the Cognito
user pool directory — the portal calls Amplify's `signUp` /
`confirmSignUp` (Cognito emails the 6-digit code) / `signIn` — and Google
and Apple are federated providers. Either way the resulting Cognito ID
token is exchanged for a FIELD session (`/auth/refresh`, `/auth/logout`
and `/auth/me` then work as before):

- `CognitoAuthGuard` (`src/auth/guards/cognitoAuth.guard.ts`) verifies the
  bearer **ID token** against `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID`
  with `aws-jwt-verify`, and attaches `{ cognitoSub, email, emailVerified,
  authProvider }` (`google` | `apple` | `password`, from the `identities`
  claim) to the request.
- `POST /auth/sync` (guarded by it) calls
  `UsersService.findOrCreateFromCognito`:
  1. `users.cognito_sub` match → updates `last_login_at`.
  2. Otherwise an existing user with the same email → links `cognito_sub` +
     `auth_provider` to that row.
  3. Otherwise it's a first-time user. With no body, the endpoint returns
     `{ status: 'profileRequired' }` and writes nothing. Called again with
     `{ companyName, phoneNumber }` (`SyncCognitoDto`, both required for
     signup), it runs self-serve signup (`src/users/cognitoSignup.ts`): a
     new tenant named after the company, the user as its Customer with that
     phone number and no password. The portal's register form sends both
     straight after the email is verified; Google/Apple users get the
     signup profile dialog.

  Signed-in responses are `{ status: 'signedIn', session }`, where
  `session` is `{ accessToken, refreshToken, expiresIn, user, tenant }`,
  and every `JwtAuthGuard` route accepts it.
- `POST /auth/password-reset/check` `{ email }` (public) runs before the
  portal asks Cognito for a reset code: `ListUsers` by email returns
  `eligible`, `notFound`, `federatedOnly` (`provider: google | apple` — no
  password to reset) or `unverified` (Cognito can't email an unverified
  address). It reveals whether an email has an account, as signup does.
- `DELETE /users/me` (`JwtAuthGuard`, 204) permanently deletes the
  caller's own account. First every Cognito user with the account's email
  or `cognito_sub` is deleted (`cognitoUserDeletion.service.ts`; a failure
  returns 503 and deletes nothing), then the database account via
  `delete_user_account()` (migration `0025`):
  personal data (sessions, devices, roles, AI conversations, feedback,
  calculator results, favourites) is deleted; shared tenant records
  (machines, history, knowledge, support, audit) stay, with the user
  reference set to NULL. A missing user returns 404.
- `GET /admin/users` (`JwtAuthGuard` + `RequireRolesGuard`, **Owner only**)
  lists users across **every** organisation for the admin portal's Users
  page. Query: `search` (name, email or organisation), `role` (role name),
  `page` (default 1), `pageSize` (default 50, max 100). Returns `{ users,
  total, page, pageSize }`; each user carries `roles`, `organisation`,
  `status`, `lastActiveAt`. Backed by the SECURITY DEFINER
  `admin_list_users()` (migration `0028`), which bypasses RLS on purpose —
  the Owner check in the guard is the only thing restricting it. Other
  roles get 403.
- Roles & permissions (`src/adminRoles`, **Owner only**) manage the
  platform-wide system roles every organisation shares:
  - `GET /admin/permissions` — the permission catalog (`code`, `label`).
  - `GET /admin/roles`, `GET /admin/roles/:roleId` — each role with
    `userCount`, `permissionCodes`, `isBuiltIn`, `arePermissionsLocked`.
  - `POST /admin/roles` `{ name, permissionCodes? }` — 409 on a duplicate
    name (case-insensitive), 400 on an unknown permission code.
  - `PATCH /admin/roles/:roleId` `{ name?, permissionCodes? }` —
    `permissionCodes` replaces the whole set.
  - `DELETE /admin/roles/:roleId` — soft delete, 204; 409 while users
    still hold the role.
  Owner and Customer (`systemRoleNames.ts`) can't be renamed or deleted,
  and Owner's permissions are locked to all. Every change writes an
  `audit_logs` row (`entity_type = 'role'`, before/after in `metadata`)
  in the same transaction, under the acting admin's organisation. Backed
  by the SECURITY DEFINER functions in migration `0029`.
- Machine library (`src/machineLibrary`, **Owner only**) — the shared
  models every organisation's machines are built from, each with a
  system → component template reused by every asset of that model
  (migration `0040`; shared reference data, no RLS):
  - `GET /admin/machineModels?search=` — `{ id, manufacturerName, name,
    displayName, category, systemsCount, assetsCount }`. `assetsCount`
    spans every organisation (SECURITY DEFINER `admin_list_machine_models`).
  - `POST /admin/machineModels` `{ manufacturerName, name, category? }` —
    the manufacturer is matched case-insensitively or created. `PATCH`
    takes any subset; `DELETE` is a soft delete (204), 409 while machines
    still use the model.
  - `GET /admin/machineModels/:modelId/tree` — `{ modelId, systems: [{ id,
    name, componentCount, components: [{ id, name }] }] }`.
  - `POST /admin/machineModels/:modelId/systems` `{ name }`,
    `PATCH`/`DELETE /admin/modelSystems/:systemId` (delete also removes its
    components), `POST /admin/modelSystems/:systemId/components` `{ name }`,
    `PATCH`/`DELETE /admin/modelComponents/:componentId`.
  - `POST /admin/machineModels/:modelId/tree/import` `{ mode?: 'merge' |
    'replace', systems: [{ name, components?: string[] }] }` — one
    transaction; merge adds only what's missing.
  Every tree change responds with the refreshed tree. Names are unique
  per parent among live rows (case-insensitive; 409 otherwise). Each
  change writes an `audit_logs` row (`entity_type` `machine_model` /
  `model_system` / `model_component`) in the same transaction.
- **Data separation & retention** (migrations `0046`–`0049`):
  - Schemas: `platform` (plan catalogue, features — all tenants read,
    service role writes), `app` (billing accounts, subscriptions,
    entitlements, usage events — RLS, a tenant reads its own rows, only the
    service role writes), `billing` (Stripe customers, invoices, webhook
    log — no tenant access, outside RLS). 0043's `tenant_subscriptions` moved
    to `app.subscriptions`. `src/dataGovernance/dataSchemas.config.ts` is the
    single description; `npm run test:db` checks the database against it and
    proves tenant A can't read tenant B and no tenant role can read billing.
  - DB roles: `field_app` = tenant role (request pool, `DATABASE_URL`, scoped
    by `app.tenant_id`); `field_service` = service role
    (`SERVICE_DATABASE_URL`, `ServiceDatabaseService`).
  - Metering: triggers write `app.usage_events` for every AI query (user
    message), machine added, user added/removed and session started — always,
    whatever the plan.
  - Audit log append-only (no UPDATE/DELETE grants); config snapshots can't
    be deleted by either role; AI conversations older than the
    organisation's `ai_query_log_retention_months` (6/12/24, default 12) are
    purged nightly (`purge_expired_ai_query_logs`, conversations under open
    review kept), audited as `ai_query_logs`.
  - `GET /admin/settings/data-retention` **(Owner)** → `{ schemas, principles,
    retention: { aiQueryLogsMonths, allowedMonths } }`; `PATCH` `{
    aiQueryLogsMonths }` changes the caller's organisation (audited).
- **Billing** (`src/billing`) — the only code allowed to import `stripe`
  (ESLint `no-restricted-imports` + `stripeImportBoundary.spec.ts`).
  `POST /billing/stripe/webhook` verifies the signature on the raw body and
  applies each event once (`billing.stripe_webhook_log`): customers link to
  an organisation via `metadata.tenant_id`; subscription events map the
  price to a plan (`platform.plans.stripe_price_id`) and sync
  `app.subscriptions` + `app.entitlements`; invoices go to
  `billing.stripe_invoices`. Feature checks use `EntitlementsService`
  (`GET /organisation/entitlements`), never Stripe.
- **Organisation subscription** (`src/organisationSubscription`, any signed-in
  user): `GET /organisation/subscription` returns the organisation's plan from
  `app.subscriptions`, or the Free plan when there is none, its term has ended,
  or Stripe cancelled it.
- **Knowledge library search** (`src/knowledgeLibrary`, any signed-in user):
  `GET /knowledge/library` (`search`, `type`, `make`, `model`, `sort`) returns up
  to 50 documents with their best passage, page and the models they mention,
  from the organisation's own and the shared library — the same visibility
  rule as AI retrieval (live version, not archived). With search text it
  ranks by Bedrock embeddings; if the model can't be reached it falls back
  to Postgres full-text (any word, title weighted) and retries AI after 5
  minutes. `searchMode` says which: `semantic`, `keyword` or `browse`.
- **Machines list** (`src/machineFleet`, migration `0052`): `GET /machines`
  (`machine.view`; filters `search`, `site`, `make`, `status`, `machineClass`)
  returns up to 200 machines, the filtered `total`, filter choices from the
  whole fleet, and `featuredDown` — a down machine with its most urgent open
  support case. `POST /machines` (`machine.create`, audited) registers a
  machine against a Machine library model (409 on a duplicate serial);
  `GET /machine-catalog` lists the library's makes and models for it.
  `machines.status` is the operating status: `running`, `down`, `service_due`.
- **Support cases** (`src/supportCases`, migration `0051`): REST at
  `/support-cases` — list (filters `status`, `priority`, `assignee`, `search`),
  `options`, create, `GET/PATCH /:caseNumber`, `GET/POST /:caseNumber/messages`.
  Raising, reading and replying need `support.create`; assign / status /
  priority need `support.manage`; replying to a resolved case is a 409. Live
  delivery is Socket.IO at namespace `/support-cases` (token in the handshake
  `auth.token`, checked in middleware): each portal joins its tenant's room
  (`case:updated`), and `case:join` adds a case's room (`case:message`,
  `case:typing`). Messages are saved over REST and pushed after commit.
- **My data** (`src/myData`, any signed-in user): `POST /me/data-export`
  queues an export (202; 409 if one is in progress) that the worker builds
  as JSON in S3 (`exports/…`, link valid 7 days); `GET /me/data-export`
  returns its status and signed download link. `POST /me/deletion-request`
  records a request and audits it (`account_deletion_request`) for an
  admin — it deletes nothing; `GET` returns the pending one.
- Notifications & alerts (`src/organisationNotifications`, **Owner only**,
  migration `0045`) — the caller's own organisation. **Configuration only:
  nothing evaluates rules or sends anything yet.**
  - `GET /organisation/notifications` — `{ rules, channels }`. The first
    visit creates the channel settings and the five default rules
    (`defaultAlertRules.ts`); deleted defaults don't come back.
  - `GET /organisation/notifications/options` — the trigger catalog
    (`alertTriggerCatalog.ts`: each trigger type's settings with limits and
    defaults), audiences and channels; the portal builds its form from it.
  - `POST /organisation/notifications/rules`, `PUT …/rules/:ruleId` — `{ name,
    triggerType, triggerParams, audiences, channels, isEnabled? }`, validated
    against the catalog (defaults filled in, unknown keys dropped). SMS is
    only accepted on a P1 `case_unactioned` rule. 409 on a duplicate name.
  - `PATCH …/rules/:ruleId` `{ isEnabled }` (the table's switch),
    `DELETE …/rules/:ruleId` (soft delete, 204).
  - `PATCH /organisation/notifications/channels` `{ push?, email?, sms? }` —
    organisation-wide switches; each rule reports `disabledChannels` it
    uses that are switched off.
  Every change is audited (`alert_rule`, `notification_channels`).
- Branding (`src/organisationBranding`, migration `0044`) — the signed-in
  user's **own** organisation (no id in the path; always `actor.tenantId`):
  - `GET /organisation/branding` — any signed-in user (the app themes
    itself from it): company name, logo (15-minute signed URL for an
    uploaded logo, else `branding_logo_url`), primary/accent colours
    (`#RRGGBB`, null = FIELD default), support footer, watermark flag.
  - `PUT /organisation/branding` **(Owner)** `{ companyName, primaryColor?,
    accentColor?, supportFooter?, showWatermark? }` — renames the
    organisation too; omitted optional fields are cleared.
  - `POST /organisation/branding/logo` **(Owner)** multipart `file` — PNG,
    JPG or SVG ≤ 2 MB; SVGs with scripts, event handlers, `javascript:`,
    embedded content or entities are refused (`storage/svgSafety.ts`).
    Stored at `branding/{tenantId}/logo-{uuid}.{ext}`; the old logo is
    deleted after the new one is saved. `DELETE …/logo` **(Owner)** removes it.
  Every change is audited as `organisation_branding`.
- Subscriptions (`src/adminSubscriptions`, **Owner only**, migration
  `0043`) — one `tenant_subscriptions` row per organisation: tier
  (standard/enterprise/pilot/demo), billing basis (per asset / negotiated
  with licensed assets / fixed fee; none for demo), start/end dates,
  monthly AI query allowance, and add-ons (wearable seats, remote expert
  seats, SSO). It's the entitlement source of truth — nothing calls
  Stripe. Organisations can read their own row (RLS); only these admin
  routes change it.
  - `GET /admin/subscriptions?status=` — every live organisation,
    including ones without a subscription (`status: not_set_up`), with
    live `assetCount` and `aiQueriesThisMonth` (UTC calendar month), plus
    `statusCounts` across all of them. Status comes from `endsOn`:
    `expired` once past it, `expiring_soon` within 30 days, else `active`.
  - `GET /admin/subscriptions/:tenantId`
  - `PUT /admin/subscriptions/:tenantId` — sets up or replaces the whole
    subscription (400 on a missing billing basis, a negotiated deal without
    licensed assets, or an end before the start). Audited as
    `tenant_subscription` with before/after.
  The Notify action (renewal reminders) isn't built yet.
- Audit log (`src/adminAuditLog`, **Owner only**, migration `0042`) —
  every organisation's `audit_logs`, newest first:
  - `GET /admin/auditLog?actorId=&entityType=&action=&from=&to=&page=&pageSize=`
    — `from` inclusive / `to` exclusive ISO timestamps. Each event has a
    readable `actionLabel` and `target` (`describeAuditEvent.ts`: the
    entity's current name, else the metadata snapshot), `actor`,
    `organisationName` and `source`.
  - `GET /admin/auditLog/filters` — actors and entity/action pairs present.
  - `GET /admin/auditLog/export` — same filters as CSV, newest 20,000
    events; `X-Export-Truncated: true` when more matched. Cells starting
    with `= + - @` are prefixed with `'` so spreadsheets don't run them.
  Source: clients send `X-Field-Client: web|mobile` (the portal's
  `httpClient` sends `web`; **the mobile app must send `mobile`**).
  `RequestSourceMiddleware` keeps it for the request and
  `insertAuditLog` stores it. Rows without a user or source (background
  jobs) are reported as `system`.
- AI configuration (`src/adminAi`, **Owner only**, migration `0041`) —
  platform-wide, across every organisation:
  - `GET /admin/ai/usage?days=30` — totals vs the prior period, active
    users, cost, queries per day (zero-filled), top 5 organisations by
    queries, flagged/unreviewed counts. A query = one technician message.
  - `GET /admin/ai/platform` — read-only provider/region/models from env.
  - `GET /admin/ai/prompts`, `GET /admin/ai/prompts/:id` — the assistant's
    system prompt versions (newest first). `POST /admin/ai/prompts`
    `{ body, notes?, publish? = true }` adds a version (versions are never
    edited); `POST /:id/publish` makes one live (also the rollback);
    `GET /:id/diff?against=` — line diff, default vs the previous version.
  - `POST /admin/ai/prompts/test` `{ body, question }` — runs the draft on
    `BEDROCK_ANSWER_MODEL_ID` via `@anthropic-ai/bedrock-sdk`; nothing is
    stored. Bedrock failures map to 502/429/503 with a readable message.
  - `GET /admin/ai/reviewQueue?status=&reviewerId=&page=&pageSize=`,
    `GET /reviewQueue/reviewers`, `GET`/`PATCH /reviewQueue/:id`
    `{ status?, notes? }`. Statuses: `unreviewed` → `in_review` →
    `resolved`/`escalated`; moving an item claims it for the caller
    unless it already has a reviewer, and `unreviewed` releases it.
  Prompt and review changes are audited (`ai_prompt_version`,
  `ai_review_item`) in the same transaction, like roles.
- Every session's `user` (`/auth/sync`, `/auth/refresh`) and
  `GET /auth/me` carry `roles` and `permissions` — the permission codes
  the user's roles grant (`userAccess.repository.ts`). `/auth/me` re-reads
  them each call, so the portal picks up role changes without a new login.
- Shared knowledge library (`src/adminKnowledge`, **Owner only**). Files
  live in S3; the database (migration `0030`) keeps only metadata and the
  S3 bucket/key. Items with `tenant_id IS NULL` are shared with every
  organisation. Files never pass through this server:
  1. `POST /admin/knowledge/uploads` `{ title, type, fileName, contentType,
     sizeBytes }` — records the document (`uploading`) and returns a signed
     S3 `PUT` URL (15 min) plus the exact headers to send.
  2. The browser PUTs the file straight to that URL.
  3. `POST /admin/knowledge/documents/:id/upload-complete` — checks the
     object exists in S3 at the declared size, then queues it for
     ingestion (`pending`).
  Also `GET /admin/knowledge/documents` (`search`, `type`, `page`,
  `pageSize`), `GET /admin/knowledge/documents/:id/download` (signed GET
  URL, 15 min) and `DELETE /admin/knowledge/documents/:id` (soft delete;
  the S3 object is kept). PDF and Word only, up to 500 MB. Create and
  delete are audited. Keys: `documents/shared/{documentId}/v{n}/{safe-file-name}`.
  Nothing processes `pending` documents yet — the ingestion pipeline
  (parse → chunk → embed) is still to be built.
- `RequireRolesGuard` + `@RequireRoles(...)` (`src/auth`) gate a route by
  role name. Roles are read from the database per request, not from the
  access token, so a role change applies immediately.
- Migration `0027_customer_role.sql` adds the `Customer` system role
  (starter permission: `ai.use`). Every self-serve signup — email/password,
  Google, Apple — gets it (`assignSignupRole.ts`); signup fails and rolls
  back if the role is missing. Existing users keep their roles.
- Migration `0026_users_avatar_url.sql` adds `users.avatar_url`. Each
  Google sign-in saves the ID token's `picture` claim there (https only;
  a sign-in with no photo keeps the saved one), and every session's
  `user.avatarUrl` carries it — email/password logins included. Needs
  Google's `picture` attribute mapped on the Cognito user pool.
- Migration `0024_users_phone_number.sql` adds nullable
  `users.phone_number`.
- Migration `0023_users_cognito_identity.sql` adds `users.cognito_sub`
  (unique index), `users.auth_provider`, makes `password_hash` nullable
  (with a check that every user has a password or a Cognito identity), and
  the RLS-bypassing
  `auth_lookup_user_by_cognito_sub()` lookup.

## File storage (StorageModule)

All files live in one private S3 bucket (`S3_PORTAL_STORAGE_BUCKET`, region
`AWS_REGION`). The database stores **S3 object keys, never URLs**; readers
get 15-minute signed GET URLs generated on read (`getSignedDownloadUrl`).
Without the env vars, upload/download endpoints answer 503 and the rest of
the API runs normally.

| Folder | Key | Accepts | Max | Stored in |
| --- | --- | --- | --- | --- |
| `documents/` | `documents/{tenantId}/{uuid}-{file}` | pdf, doc, docx | 20 MB | `document_versions.storage_key` |
| `documents/shared/` | `documents/shared/{documentId}/v{n}/{file}` | pdf, doc, docx | 500 MB | same — the admin library (browser uploads direct via signed PUT) |
| `photos/` | `photos/{tenantId}/{machineId}/{uuid}-{file}` | jpg, jpeg, png, heic | 10 MB | `technical_attachments.storage_key` (`file_type = 'photo'`) |
| `avatars/` | `avatars/{tenantId}/{userId}.{ext}` | jpg, jpeg, png | 5 MB | `users.avatar_storage_key` |

- **Validation** (`storageFileRules.ts`): extension, size, and the file's
  leading bytes must match (a renamed `.exe` isn't a PDF). The stored
  content type comes from the extension, never the client's MIME type.
- **Tenant boundary** (`storageKeys.ts` `isTenantOwnedKey`): `deleteFile`
  only deletes keys under `{documents|photos|avatars}/{callerTenantId}/`
  and rejects `..`/empty segments — the shared library and other tenants'
  files can't be deleted through it.
- **Endpoints** (all `JwtAuthGuard`, tenant from the JWT; multipart field
  `file`):
  - `POST /documents` (`type`, `title?`; needs `knowledge.submit`),
    `GET /documents` (own + shared, each with a signed `downloadUrl`),
    `GET /documents/:id/download`.
  - `GET /machines/:machineId`, `GET /machines/:machineId/history`
    (`machine.view`); `POST /machines/:machineId/history`,
    `POST …/history/:entryId/photos` (`history.create`);
    `DELETE …/history/:entryId/photos/:photoId` (`history.delete_photos`)
    — a **soft** delete: the row and S3 object stay for the audit trail.
  - `PATCH /users/me` (first/last name), `POST /users/me/avatar`.
- **Uploads** go S3 first, then the database; if the database write fails
  the object is deleted again. Upload responses include `file:
  { key, signedUrl, uploadedAt }`.
- **Avatars:** a new upload overwrites the same key when the extension
  matches; otherwise the previous object is deleted once the new one is
  saved. An uploaded avatar takes precedence over the Google photo
  (`users.avatar_url`), and Google sign-ins never replace it. Deleting an
  account also deletes its avatar file. Sessions, `/auth/me` and the admin
  user list return the resolved `avatarUrl` (signed when it's an upload).
- **Page counts** (`src/knowledge/documentPageCount.service.ts`): after an
  upload completes, a background job reads the file from S3 and records
  `document_versions.page_count` — PDFs from the page tree (pdf-lib, works
  for password-protected files), DOCX from Word's `docProps/app.xml`.
  Legacy `.doc` and files over 150 MB get no count. One file at a time; a
  startup sweep catches anything missed. A file that can't be parsed is
  marked `failed`. The API's `isPageCountPending` tells the portal to keep
  polling.
- **Permissions** are enforced server-side by `RequirePermissionsGuard`
  (`@RequirePermissions(...)`), reading the caller's role permissions per
  request.

The bucket should block all public access and allow this CORS (the admin
library's direct PUT, and downloads):

```json
[{
  "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001", "https://<portal domain>"],
  "AllowedMethods": ["PUT", "GET"],
  "AllowedHeaders": ["Content-Type"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3000
}]
```

The backend's credentials need (`s3:ListBucket` makes a missing object
read as "not found" rather than "access denied"):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::<bucket>/documents/*",
        "arn:aws:s3:::<bucket>/photos/*",
        "arn:aws:s3:::<bucket>/avatars/*",
        "arn:aws:s3:::<bucket>/branding/*",
        "arn:aws:s3:::<bucket>/exports/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::<bucket>"
    }
  ]
}
```

## Knowledge indexing pipeline (`src/knowledgeIndexing`)

A DB-polling worker inside the API picks up document versions in state
**queued** (`document_versions.ingestion_status = 'pending'`) with
`claim_next_indexing_job()` (`FOR UPDATE SKIP LOCKED`, so several API
instances are safe; a job idle for 30 min is reclaimed after a crash). It
polls every 5 s and is woken straight away after uploads/retries.

1. **Extract** — PDF text per page with pdf.js 3.11 (`isEvalSupported:
   false`, CVE-2024-4367); headings from font size / section numbering.
   DOCX via mammoth (Word heading styles). Legacy `.doc` → failed with a
   "save as PDF/DOCX" message. Pages with no text layer are OCR'd with
   Amazon Textract (async, straight from S3) when `TEXTRACT_OCR_ENABLED=true`.
2. **Chunk** — ~900 tokens (≈4 chars/token), ~100-token overlap; each chunk
   keeps its page number and section heading.
3. **Embed** — Amazon Bedrock Titan Text Embeddings v2, 1024 dimensions,
   normalised → `document_chunks.embedding` (pgvector, HNSW index).
4. **Link** — machine-library models mentioned ("CAT 793F", "793F") →
   `knowledge_item_machine_models`.
5. **Finish** — shared-library bulletins/policies → **needs_review**;
   everything else → **live** (and becomes `documents.live_version_id`).
   Any error → **failed** with an actionable `error_message`.

Progress (0–100) is stored per version. Every transition is audit-logged
(worker transitions inside the SQL functions, user actions by the API).
States map onto existing columns — see migration `0035`.

**Endpoints** (JwtAuthGuard; visible = own organisation + shared library):
`GET /documents/:id/status`, `POST /documents/:id/approve` | `reject`
(`{ reason }`) | `retry` | `archive`, `POST /documents/:id/versions`
(multipart, ≤ 20 MB), `DELETE /documents/:id` (permanent: versions,
chunks, S3 files). Shared-library changes and reviews are Owner-only;
an organisation's own documents need `knowledge.submit`
(`src/documents/documentAccess.ts`). Large shared-library versions:
`POST /admin/knowledge/documents/:id/versions` (signed PUT, ≤ 500 MB) then
`…/upload-complete`.

**AI retrieval:** `POST /knowledge/search` (`ai.use`) embeds the query and
returns the closest chunks — only from each document's live version, not
archived, and only the caller's organisation + the shared library
(`src/knowledgeSearch`). The AI assistant should retrieve through
`KnowledgeSearchService`, never query `document_chunks` directly.

**IAM** for the backend's credentials, in addition to the S3 policy above:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:<region>::foundation-model/amazon.titan-embed-text-v2:0"
    },
    {
      "Effect": "Allow",
      "Action": ["textract:StartDocumentTextDetection", "textract:GetDocumentTextDetection"],
      "Resource": "*"
    }
  ]
}
```

## Environment variables required

- `NODE_ENV`
- `PORT`
- `DATABASE_URL` — Postgres connection string, `sslmode=verify-full`
- `JWT_SECRET` — signs access tokens
- `JWT_REFRESH_SECRET` — signs refresh tokens (must differ from `JWT_SECRET`)
- `PORTAL_ORIGIN` — allowed CORS origin(s) for the frontend, comma-separated
- `COGNITO_USER_POOL_ID` — Cognito User Pool that issues Google/Apple ID tokens
- `COGNITO_CLIENT_ID` — the portal's Cognito app client (the ID token audience)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — only when not running under
  an IAM role; need `cognito-idp:ListUsers` and `cognito-idp:AdminDeleteUser`
  on the user pool (account deletion), plus the S3 permissions under "File storage"
- `S3_PORTAL_STORAGE_BUCKET` — the private S3 bucket for documents, photos
  and avatars (optional; file endpoints answer 503 without it)
- `AWS_REGION` — that bucket's region
- `KNOWLEDGE_INDEXING_ENABLED` — `false` to not run the indexing worker in
  this process (default: runs)
- `BEDROCK_EMBEDDING_MODEL_ID` — default `amazon.titan-embed-text-v2:0`
- `BEDROCK_REGION` — Bedrock/Textract region (default `AWS_REGION`)
- `TEXTRACT_OCR_ENABLED` — `true` to OCR scanned pages (default off)
- `KNOWLEDGE_INDEXING_MAX_MB` — largest file indexed (default 200)
- `BEDROCK_ANSWER_MODEL_ID` — Claude inference profile for technician
  answers and the prompt Test button (default
  `au.anthropic.claude-sonnet-4-5-20250929-v1:0`)
- `SERVICE_DATABASE_URL` — connection string for the `field_service` role
  (billing module, background jobs); falls back to `DATABASE_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe, used only by
  `src/billing`; unset = billing endpoints answer 503
- `AI_LOG_RETENTION_JOB_ENABLED` (default on), `AI_LOG_RETENTION_HOUR_UTC`
  (default 17) — the nightly AI query log purge
- `DATA_EXPORT_WORKER_ENABLED` (default on; needs S3) — "My data" exports
- `BEDROCK_BACKGROUND_MODEL_ID` — Claude inference profile for background
  work (default `au.anthropic.claude-haiku-4-5-20251001-v1:0`)

See `.env.example` for the full list.
