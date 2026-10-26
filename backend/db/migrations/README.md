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
| `0051` | Support cases — `case_number` (from 1001), `priority`, `category`, `created_by` (reporter, SET NULL), `resolved_at`; status/priority/category checks |
| `0052` | Machines list — `machines.site`, `operating_hours`; `status` becomes the operating status (`running`/`down`/`service_due`, was `active`) |
| `0063` | `ai_platform_usage_log` — Bedrock usage outside answers (prompt tests, indexing, search) |
| `0064` | Reports — `admin_report_*` functions for the CSV exports, `scheduled_reports` |
| `0065` | Alert delivery — `alert_rules.cooldown_minutes`, `notifications.rule_id`/`entity_key` and kind `alert`, `notification_deliveries`, `pg_notify` on new notifications, SECURITY DEFINER `alert_*` functions for the rule engine |
| `0066` | Demo requests — `platform.demo_requests` (marketing-site demo form: contact details, follow-up status + notes, team/confirmation email sent times, IP); service role only, no tenant access |
| `0067` | `platform.demo_requests.user_agent` (the submitting browser's User-Agent) |
| `0068` | Machine detail — each machine's installed system/component tree seeded from its model template (trigger on `machines` insert + backfill, with a `baseline` snapshot), history entries' component/hours/downtime, `machines.operating_hours_read_at`, `configuration_snapshots.is_known_good`, `machine_photos` gallery |
| `0069` | Support case chat — statuses `new`/`open`/`waiting_on_customer`/`resolved`/`closed` (`in_progress` → `open`, unassigned `open` → `new`), `description`, SLA (`sla_due_at`, `sla_paused`, `sla_paused_at`; a status trigger pauses/resumes it and sets `resolved_at`/`closed_at`), `support_updates.author_role` + `is_internal` (staff-only notes), message-linked `support_attachments`, `case_events` (append-only thread lines), `support_case_reads` (unread badge) |
| `0070` | Support staff — `support.agent` permission (Owner + new default `Support Agent` system role only, enforced by trigger), SECURITY DEFINER `user_has_permission()`, `support_case_person()` (names staff across organisations, nobody else), `support_case_tenant_id()` |
| `0071` | Support queue — SECURITY DEFINER `admin_list_support_cases()`, `admin_support_case_stats()`, `admin_list_support_staff()`, `support_staff_unread_case_count()` |
| `0072` | Case lifecycle — `support_close_resolved_cases()` (7-day auto-close with event + audit), 0054's case notification triggers skip customers on internal notes and link staff to `/admin/cases/:n`, 0064/0065 case report and unactioned-case alert on the new statuses |
| `0073` | Support staff members — `is_support_staff()`: `support.agent`, `platform.manage`, or anyone in an organisation with a platform administrator (QuipTech's team); `support_case_person()` uses it |
| `0074` | Assign dropdown — `admin_list_support_staff()` returns every active user with `organisation_name` and `is_support_staff` (staff first); only staff can be assigned |
| `0075` | Team assignees — the assign dropdown marks staff by `is_support_staff()`, matching the API |
| `0076` | Knowledge article — `document_sections` (heading, start page, text per section) and `document_figures` (captions; image key for later) per version, saved by the indexer via `replace_document_sections()` or backfilled from chunks on first view (`backfill_document_sections()`), text index for search-to-section matching, `document_versions.summary` |
| `0077` | Admin removes a user — `removed_accounts` (email of each removed account, so sign-in says an administrator removed them), SECURITY DEFINER `is_last_active_owner()`, `admin_find_removable_user()`, `admin_remove_user()` (record + audit with the admin + `delete_user_account()`) |
| `0078` | `list_knowledge_documents()` — SECURITY DEFINER knowledge list (latest version per item) with explicit visibility (shared + own organisation, or every organisation for the Owner), so the Owner's Knowledge screen matches the overview count under `field_app` RLS |
| `0084`–`0085` | Knowledge brands, nested categories, organisation grants, document/model links, chunk metadata and Uncategorised backfill; existing S3 keys and embeddings are retained |
| `0086`–`0087` | Brand-aware RLS/shared access predicates, category-cycle validation, chunk metadata synchronisation, explicit model-link preservation and review for all new documents |
| `0088`–`0091` | Scoped document lists/filters, audited metadata moves, numeric-version key reservation and retained AI answer provenance |
| `0092` | Passkey sign-in (Face ID / Touch ID / Windows Hello) — `user_passkeys` (public keys only; owner-only RLS, hard delete, cascades with the user), single-use 5-minute `webauthn_challenges` reachable only through SECURITY DEFINER `webauthn_issue_challenge()` / `webauthn_take_challenge()`, and `auth_lookup_passkey()` for sign-in before the tenant is known |
| `0093` | Every organisation sees every active Knowledge brand: `knowledge_has_brand_access()` no longer checks per-organisation grants (inactive brands stay admin-only; organisation-private documents unaffected). `organisation_brand_access` is kept, unused |
| `0094` | FIELD-calculated invoicing — drops 0046's Stripe Subscription sync (`billing.stripe_customers`/`stripe_invoices`/`stripe_webhook_log`, `app.billing_accounts`, `platform.plans.stripe_price_id`); adds `billing.billing_accounts`, `tenants.billing_account_id`, `billing.invoices`, `billing.invoice_lines`, `billing.stripe_webhook_events` (service role only) and audited `admin_create_billing_account()` / `admin_create_draft_invoice()` |
| `0095` | Billing pricing — `billing.config` (spec §11 keys, jsonb values, `is_final` = false on the placeholder allowances), billing plan codes in `platform.plans` (+ `unit`, `billing_basis`; `ASSET_PRO`, `TECH`, `REMOTE_SESSION`, `ENTERPRISE`, `ONBOARD_ASSISTED`, `HARDWARE`, `INTERNAL`), versioned `billing.price_books` + `billing.price_bands` seeded with version 1 (service role only) |
| `0096` | Billing subscriptions — `billing.subscriptions` (per billing account, pinned `price_book_id` and annual months charged; one live per plan), `billing.seats` (TECH), billing account partner/contact/suspension columns; RLS own-account read-only on `billing_accounts`, `subscriptions`, `seats`, `invoices`, `invoice_lines` via `current_billing_account_id()`; `billing.record_audit_entry()` (audit from the service role), `billing.user_belongs_to_account()`; copies `app.subscriptions` onto accounts that exist (standard → ASSET_PRO, enterprise → ENTERPRISE, pilot/demo → INTERNAL) |
| `0097` | Machine lifecycle — `machines.lifecycle_state` (`registered`/`active`/`archived`/`sold`; existing machines start `registered`), `billing.machine_activations` (one open interval a machine), `billing.machine_lifecycle_events`, `billing.machine_transfers` (request/approve, chain of custody), `billing.review_tasks` (one open per account and type); `billing.manage` + `machine.lifecycle` permissions, default `Organisation Admin` role; SECURITY DEFINER `billing.apply_machine_transition()` |
| `0098` | Personal TECH payments — `billing.personal_accounts` (one separate personal billing account per user), `billing.personal_periods` (one pinned invoice per user/calendar month); RLS checks both tenant and user context, service-only writes, row-version triggers. Existing organisation accounts and subscriptions are unchanged. |
| `0099` | Personal period replacement — `billing.personal_periods.replaced_at`; uniqueness per user and month only for the current (not replaced) period, so a refunded or void month gets a fresh invoice while the old one stays in history |
| `0100` | Machine transfer completion — SECURITY DEFINER `billing.complete_machine_transfer()`: moves the machine, installed systems/components and configuration snapshots to the buyer as `registered`, clears seller fleet/asset number, site and people, ends the seller's activation interval, writes both lifecycle events |
| `0101` | Monthly billing run — `billing.daily_billable_counts` (one row per account and billing day, never rewritten; RLS own-account read), invoice `period_start`/`period_end`/`review_until`/`held_at`/`held_by`/`hold_reason`, one run invoice per account and month (`uq_invoices_account_period`), `invoice_lines.calc_snapshot` |
| `0102` | Knowledge catalogue (mobile app) — `knowledge_recent_views` (RLS), `document_pages` (per-page text from the indexer; readable like `document_sections`), SECURITY DEFINER `replace_document_pages()`. Brands and categories are 0084's |
| `0103` | Support case first response — `support_cases.first_response_at` (first staff reply the customer can see; internal notes don't count), set by a SECURITY DEFINER trigger on `support_updates`, backfilled; `admin_list_support_cases()` also returns it and `resolved_at` |
| `0104` | Machine app fields — `machines.cover_photo_id` (gallery photo shown for the machine; newest when unset), `machine_assignments` (technicians per machine, RLS), snapshot triggers `before_restore` / `restored` for restoring a configuration snapshot |
| `0105` | Profile preferences — `users.site` (where the person usually works) and `users.language` (BCP 47 tag, default `en`, checked) |
| `0106` | App devices, preferences and sync — `device_registrations.app_version`/`last_seen_at`, one row per user and token, deletable; `user_notification_preferences` (push/email on-off, muted kinds); `idempotency_keys` (saved responses for the app's outbox retries) |
| `0107` | Knowledge catalogue cleanup — removes the first draft of 0102's manufacturer-based brands (`tenant_brand_access`, `tenants.knowledge_brands_restricted`, `knowledge_items.manufacturer_id`/`category_id` and their functions); aligns `document_pages` visibility. A no-op where that draft never ran; 0084 drops the draft's `knowledge_categories` first |
| `0108` | Component details and Idempotency-Key body checks — `installed_components` part number, manufacturer, condition note/severity, install date/hours, next service due hours, notes; `idempotency_keys.request_hash` (same key + different body = 422) |
| `0109` | Billing operations — every organisation on a billing plan (backfill: a billing account for each organisation with users, monthly ASSET_PRO, or INTERNAL for QuipTech's own; spec T22), invoice `kind` (monthly/annual/onboarding/personal/manual), `due_on` and day-1/day-7 overdue notice stamps, `amount_credited_cents`, one monthly and one annual invoice per account and period, `billing.credit_notes`, subscription `next_term`/`next_committed_qty`, `billing.onboarding_jobs`, `SUSPENSION_NOTICE_DAYS` config, notification kind `billing` with `billing.notify()`/`account_admins()`/`platform_admins()`, `billing.personal_payers()` (the service role can't read `users`), `current_billing_suspended()` |
| `0110` | Entitlements and metering — the spec's feature keys per plan (`platform.plan_features`) resolved by `current_feature_keys()` from the account's live plans (no plan ever = ASSET_PRO; ended plan = none); `app.usage_events` `billing_account_id`/`unit`/`idempotency_key` (unique), bigint quantity, `ai.turn`/`ai.session`/`storage.delta`/`doc.ingest` types, `record_my_usage_event()` for the app, storage and ingestion triggers plus a storage baseline per organisation, `billing.allowance_periods` (RLS own-account read) |

See [Knowledge rollout](../../src/knowledgeBrands/README.md) for deployment order and compatibility.

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
