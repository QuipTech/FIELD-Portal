# auth/adminScope

## Purpose

Decides which organisations an admin request may see, in one place. The **Owner** role is the platform administrator: it holds `platform.manage` and gets every organisation (`tenantId: null`). Anyone else gets no admin access (403).

Admin repositories pass `scope.tenantId` as the first argument (`p_tenant_id`) of the cross-organisation SQL functions (migrations 0056–0058). Scoping is therefore enforced in the database query, not just in the portal. A request can narrow its scope to one organisation (e.g. the Users screen's Organisation filter), but never widen it.

## Folder structure

```
adminScope/
├── adminScope.ts                     ← AdminScope type + resolveAdminScope (pure, tested)
├── adminScope.guard.ts               ← AdminScopeGuard: loads roles/permissions per request, sets request.adminScope
└── currentAdminScope.decorator.ts    ← @CurrentAdminScope(); throws if the guard is missing (never defaults to "all")
```

## How to run locally

Part of the API. Unit tests: `npx jest src/auth/adminScope`.

## Key conventions

- Admin routes use `@UseGuards(JwtAuthGuard, AdminScopeGuard)` and pass the scope down to the repository.
- Platform-wide changes (setting subscriptions, the AI prompt) also require `@RequirePermissions(PLATFORM_PERMISSION_CODE)`.
- Only `resolveAdminScope` produces a `null` (every organisation) tenant id.

## Environment variables required

None. Owner is granted in the database (`user_roles`); self-serve signups get Customer.
