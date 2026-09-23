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
