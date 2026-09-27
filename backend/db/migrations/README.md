# Migrations

Numbered SQL files, applied in order with `psql` (see the backend
`README.md`). Implements the QuipTech FIELD Phase 1 schema end to end:
every tenant-scoped table has `tenant_id`, `created_at`, `updated_at`, and
`row_version`; most also have `deleted_at` (soft delete only — the
`field_app` role has no `DELETE` grant except where explicitly noted).
Row-level security is `ENABLE`d and `FORCE`d on every tenant table, keyed
off `current_tenant_id()`, a function reading `app.tenant_id` from the
session (set per-request by `DatabaseService.withTenant`).

| File | Contents |
| --- | --- |
| `0002` | Extensions (`pgcrypto`, `vector`), `current_tenant_id()`, `bump_row_version()` trigger, the `field_app` role |
| `0003`–`0005` | Identity & Access — tenants, users, roles/permissions, sessions, device registrations |
| `0006`–`0010` | Machine & System History — machines, installed systems/components, technical history, configuration snapshots + diff functions |
| `0011`–`0015` | Knowledge Centre — knowledge items, documents, `pgvector` chunks, resolution records, review/feedback |
| `0016`–`0019` | AI Assistant — conversations, messages, citations, review/escalation queues, model config (read-only for `field_app`) |
| `0020` | Technical Support (Phase 1 reference model — Zoho Desk is the system of record) |
| `0021` | Technical Toolbox — calculators (shared library) and per-user results/favourites |
| `0022` | Audit — `audit_logs` (append-only) |
| `0023` | Cognito identity on `users` — `cognito_sub` (unique), `auth_provider`, nullable `password_hash`, `auth_lookup_user_by_cognito_sub()` |
| `0024` | `users.phone_number` (nullable; collected at Google/Apple signup) |
| `0025` | Account deletion — `delete_user_account()` (SECURITY DEFINER hard delete of a user + personal data); authorship columns on shared records made nullable so they outlive a deleted user |
| `0026` | `users.avatar_url` (Google profile photo, refreshed on each Google sign-in); both `auth_lookup_*` functions now also return it |
| `0027` | `Customer` system role (granted `ai.use`) — the role every self-serve signup now receives instead of `Owner` |
| `0028` | `admin_list_users()` — SECURITY DEFINER, platform-wide user directory (search, role filter, paging) for `GET /admin/users`; restricted to Owners by the backend guard |
| `0029` | Role management — 6 permissions the portal design needs (Owner granted all), unique live system-role names, and SECURITY DEFINER `admin_list_roles` / `admin_create_role` / `admin_update_role` / `admin_delete_role` for the `/admin/roles` API |
| `0030` | Shared knowledge library — `tenant_id` nullable on `knowledge_items`/`documents`/`document_versions` (NULL = shared, readable by every tenant), `manual`/`procedure` types, `uploading` ingestion status, S3 location + file metadata columns, SECURITY DEFINER create/finish-upload/delete functions |
| `0031` | File storage — S3 key + file metadata + `uploaded_by` on `technical_attachments` (photos, soft-deletable via a new update policy), `fault` history entry type, `users.avatar_storage_key`, `history.delete_photos` permission (Owner) |
| `0032` | `auth_lookup_user_by_*` and `admin_list_users()` also return `avatar_storage_key` |
| `0033` | `delete_user_account()` also clears `technical_attachments.uploaded_by` |
| `0034` | Page counts — `document_versions.page_count_checked_at`, SECURITY DEFINER `list_document_versions_missing_page_count()` / `record_document_page_count()` for the background counting job |

## Two forward references, resolved across files

`knowledge_items.resolution_record_id` → `resolution_records` (added in
`0014`, once that table exists) and `resolution_records.conversation_id` →
`ai_conversations` (added in `0016`) both point at tables created later in
the sequence — the column is created without the FK, and the FK is added
via a guarded `ALTER TABLE` once the target table exists.

## Gaps filled in beyond the literal per-table field lists

The source doc's per-table boxes aren't exhaustive (most omit
`created_at`/`updated_at`/`row_version`, which the intro says every table
has). Where a table's box also omitted `tenant_id` but the table clearly
holds one tenant's data (e.g. `installed_systems`, `ai_messages`,
`support_updates`), `tenant_id` + RLS were added for consistency. Treated
as shared, non-tenant reference libraries instead (no `tenant_id`/RLS):
`tenants` itself, `permissions`, `machine_manufacturers`/`machine_models`,
`toolbox_items`.
