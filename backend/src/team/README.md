# team

## Purpose

An organisation admin's Team screen (`/team`, needs `admin.manage_users`): the organisation's people, the roles they can be given, invitations, role changes and removal. It reuses the Owner's Users services (`src/adminUsers`), always narrowed to the caller's own organisation, and never offers a role that grants QuipTech-only permissions (`platform.manage`, `support.agent`, `support.manage`).

## Folder structure

```
team/
├── team.controller.ts       ← GET /team, GET /team/roles, POST /team/invitations, PATCH /team/:id/role, DELETE /team/:id
├── team.service.ts          ← scopes every call to the caller's organisation, checks members and roles first
├── teamRoleRules.ts         ← which roles an organisation admin may hand out (pure, tested)
└── teamAccess.repository.ts ← is this user in the organisation?
```

## How to run locally

Runs inside the API (`npm run start:dev`). Tests: `npx jest src/team`; database: `npm run test:db -- test/profileAndBilling.db-spec.ts`.

## Key conventions

- Someone outside the caller's organisation is 404, never 403.
- The Users page's own rules still apply: not your own role, never the last Owner, the role must belong to the organisation (system roles or its own).
- The Owner keeps `/admin/users` for every organisation.

## Environment variables required

Those of `src/adminUsers` (Cognito, for invitations): `COGNITO_USER_POOL_ID`, `AWS_REGION`.
