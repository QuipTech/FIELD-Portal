# QuipTech FIELD — Portal Backend

## Purpose

This is the backend API for the QuipTech FIELD Portal — a NestJS service that
backs the User Portal and Admin Console frontend at `portal/`. The full
Phase 1 database schema (multi-tenant, RLS-enforced) lives under
`db/migrations/`, and the first API surface — registration and login — is
implemented under `src/auth/`.

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
│       ├── dto/, types/, strategies/, guards/, decorators/
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
- Passwords are hashed with bcrypt (via `bcryptjs`, pure JS — no native
  build step). Refresh tokens are signed JWTs; only their SHA-256 digest is
  stored (`sessions.refresh_token_hash`), so a leaked database dump can't be
  replayed as a live session.
- `DATABASE_URL` uses `sslmode=verify-full`, and Node doesn't ship Amazon's
  RDS CA in its trust store — `DatabaseService` strips `sslmode` out of the
  connection string and supplies `certs/rdsGlobalBundle.pem` as the `ssl.ca`
  explicitly instead. This isn't optional: `pg` gives a `sslmode` found in
  the connection string priority over an `ssl` option passed alongside it,
  so if both are present the explicit CA is silently ignored and you get
  `self-signed certificate in certificate chain`.

## Environment variables required

- `NODE_ENV`
- `PORT`
- `DATABASE_URL` — Postgres connection string, `sslmode=verify-full`
- `JWT_SECRET` — signs access tokens
- `JWT_REFRESH_SECRET` — signs refresh tokens (must differ from `JWT_SECRET`)
- `PORTAL_ORIGIN` — allowed CORS origin for the frontend
