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
| `0035` | Indexing schema — review fields on `knowledge_items`, progress/error on `document_versions`, `documents.live_version_id`, shared (nullable-tenant) chunks, `knowledge_item_machine_models`, Policy/Parts book types |
| `0036` | Indexing worker functions — claim (SKIP LOCKED), progress, chunk insert, machine-model links, audit of transitions |
| `0037` | Lifecycle functions — complete/fail indexing, approve/reject/archive/retry |
| `0038` | New document versions and permanent deletion (+ grants for 0037) |
| `0039` | `delete_user_account()` also clears `knowledge_items.reviewed_by` |
| `0040` | Machine library — `model_systems` / `model_components` (each model's system & component template; shared, no RLS), live-name unique indexes (also replaces `machine_models`' plain unique constraint), SECURITY DEFINER `admin_list_machine_models()` with cross-tenant asset counts |
| `0041` | AI admin console — `ai_prompt_versions` (platform-wide, one live version), `ai_review_items` statuses `unreviewed`/`in_review`/`resolved`/`escalated` (existing `pending`→`unreviewed`, `reviewed`→`resolved`) plus `reason_code`, `reviewer_id`, `reviewed_at`; SECURITY DEFINER usage, review-queue and prompt-listing functions |
| `0042` | Audit log page — `audit_logs.source` (`web`/`mobile`, from the `X-Field-Client` header; NULL on older rows), time indexes, SECURITY DEFINER `admin_list_audit_logs()` (cross-tenant, with actor and current target names), `admin_list_audit_actors()`, `admin_list_audit_event_types()` |
| `0043` | Subscriptions — `tenant_subscriptions` (one per tenant: tier, billing basis, licensed assets, term, monthly AI allowance, wearable/remote-expert seats, SSO); RLS read-only for the tenant, SECURITY DEFINER `admin_list_tenant_subscriptions()` (with live asset and monthly query counts) and `admin_upsert_tenant_subscription()` |
| `0044` | Branding — `tenants.branding_color_accent`, `branding_support_footer`, `branding_show_watermark`, `branding_logo_storage_key` (uploaded logo; wins over `branding_logo_url`), `#RRGGBB` check on both colours (NOT VALID, so older rows aren't re-checked) |
| `0045` | Notifications & alerts — `notification_channel_settings` (per-tenant push/email/sms switches) and `alert_rules` (trigger type + JSON params, audiences, channels, on/off; soft delete, unique live name per tenant), both RLS-scoped |
| `0046` | Schema separation — `field_service` role; `platform` (plans, features, plan_features), `app` (billing_accounts, subscriptions ← moved from `tenant_subscriptions`, entitlements, usage_events; RLS own-rows read-only), `billing` (stripe_customers, stripe_invoices, stripe_webhook_log; service role only); `app.sync_entitlements()`; 0043's admin functions repointed |
| `0047` | Usage metering triggers → `app.usage_events` (AI query, asset added, seat added/removed, session started) |
| `0048` | Retention — audit_logs append-only grants, no deletes on configuration snapshots, `tenants.ai_query_log_retention_months`, `purge_expired_ai_query_logs()` |
| `0049` | My data — `data_export_requests` (+ worker claim/finish/expire functions), `account_deletion_requests` |
| `0050` | An admin edit of a subscription makes it manually managed (`source = 'manual'`, clears `stripe_status`), so a Stripe-cancelled row doesn't keep entitlements off |

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
