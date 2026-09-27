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
│   └── users/
│       ├── users.module.ts / users.service.ts  ← findOrCreateFromCognito
│       ├── userProfile.service.ts ← PATCH /users/me, POST /users/me/avatar
│       ├── cognitoSignup.ts      ← new tenant + Owner for first-time Google/Apple users
│       ├── users.controller.ts / accountDeletion.service.ts
│       │   / cognitoUserDeletion.service.ts
│       │                         ← DELETE /users/me (self-service account deletion)
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

## Cognito sign-in (Google / Apple)

Email/password auth (`/auth/register`, `/auth/login`, `/auth/refresh`,
`/auth/logout`, `/auth/me`) is unchanged. Cognito is used only for Google
and Apple sign-in, and is exchanged for the same FIELD session:

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
     new tenant named after the company, the user as its Owner with that
     phone number and no password — the same shape `/auth/register` creates.

  Signed-in responses are `{ status: 'signedIn', session }`, where
  `session` is the same shape `/auth/login` returns, so
  every `JwtAuthGuard` route works for Google/Apple users unchanged.
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
- Every session's `user` (login, register, refresh, Google/Apple) and
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
        "arn:aws:s3:::<bucket>/avatars/*"
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

See `.env.example` for the full list.
