# Brand-scoped Knowledge

Knowledge brands are platform reference data; they are independent of machine
manufacturers. Categories belong to one brand and may have a parent within it.
`documents` owns `brand_id`, `category_id` and `document_type`.
`document_machine_models` stores explicit model selections; automatic detection
continues using `knowledge_item_machine_models` and preserves explicit links.

## Access

`Owner` with `platform.manage` is the existing platform administrator. No new
role is introduced. Clients need an `organisation_brand_access` grant and an
active brand. A grant never exposes another organisation's private documents.

SQL `knowledge_has_brand_access` and `knowledge_can_read_document` are the
shared checks for RLS and all query paths. `knowledgeAccess.ts` exposes helpers
for scope validation and accessible brand IDs. Read current grants on each
request, never cache them in tokens. Hidden document IDs return 404 before
storage signing. Only a live version is searchable by clients.

Request queries run in `withActor` so `app.tenant_id` and `app.user_id` are local
to the transaction. Indexing/lifecycle SQL functions remain privileged internal
operations. They must only be called after the API's permission/access checks.

## API

All routes require the normal authenticated FIELD session, for both web and
mobile. Administrative routes also require the existing platform admin guard.

| Route | Methods / purpose |
| --- | --- |
| `/admin/knowledge/brands` | GET list, POST create |
| `/admin/knowledge/brands/:id` | GET detail, PATCH edit, DELETE empty brand |
| `/admin/knowledge/brands/:id/logo` | POST multipart `file`, PNG/JPG/SVG <=2 MB |
| `/admin/knowledge/brands/:brandId/categories` | GET tree rows, POST category |
| `/admin/knowledge/brands/:brandId/categories/:id` | PATCH edit/parent/order, DELETE empty folder |
| `/admin/organisations/:id/brand-access` | GET grants, PUT `{brandIds: string[]}` |
| `/admin/knowledge/documents/:id` | PATCH brand/category/documentType/machineModelIds |
| `/knowledge/brands` | GET accessible brands, published counts, signed logos |
| `/knowledge/brands/:brandId/categories` | GET accessible categories |
| `/knowledge/models` | GET models linked to accessible published documents |
| `/knowledge/documents` | GET browse/search with filters and pagination |
| `/knowledge/documents/:id` | GET article details, classification and `pdfUrl` |
| `/knowledge/search` | GET ranked snippets and plain-text `highlights` |

User list/search filters: `brandId`, `categoryId`, `documentType`,
`machineModelId`, `q`, `page` and `pageSize` (maximum 100). Existing
`search`, `type`, `make`, `model`, `/knowledge/library`, `/documents`, article,
status/download, and POST `/knowledge/search` routes remain compatible and
apply brand access. Document IDs in these routes remain knowledge-item IDs,
matching existing portal/article/citation links.

Admin list filters also support `status`: `draft`, `needs_review`, `published`,
`archived`. PATCH metadata accepts partial fields; a brand move must include a
category belonging to the new brand. Legacy document types remain valid.

New uploads require brand/category and a document type. `documentType` and the
existing `type` field are supported; the portal continues sending `type`.
Optional `machineModelIds` are a UUID array. Bulk selection applies these
values to every file. The existing signed PUT -> complete -> indexing flow
remains, and all new documents require approval before publication.

AI requests accept optional top-level `brandId`, `categoryId`, `documentId`.
Scope only narrows the caller's accessible sources. Scoped requests omit old
conversation context to prevent other scopes from influencing answers. Stored
answers retain document provenance even if chunks are removed; answers whose
sources become inaccessible are withheld from thread history and model input.

## Files and revocation

New document versions use:
`knowledge/brands/{brandId}/{categoryId}/{documentId}/v{number}/{safeFileName}`.
The database reserves version numbers under a document lock. Versions store
the exact full key; category/brand moves never relocate existing S3 objects.
The bucket stays private. Existing `documents/...` keys continue working.

Revocation prevents new API reads, retrieval and URL issuance immediately.
Already issued S3 URLs expire after 15 minutes; downloaded files cannot be
recalled. Knowledge offline fallback/save controls are disabled and legacy
IndexedDB copies are cleared when an article loads. Mobile clients must also
revalidate access and discard cached content after revocation; this repository
contains the portal and shared API, not a native mobile app.

## Migration and rollout

Run the existing `backend/db/applyMigrations.sh` with `MIGRATION_DATABASE_URL`
through the normal deployment process. No live database is migrated by tests.
Migrations 0084-0091 add the schema, backfill, access policies, consistency
triggers, document list function, metadata updates, numeric version reservation,
and saved AI provenance. The runner skips recorded versions.

Existing documents/chunks are assigned to Uncategorised > General. Existing
organisations receive Uncategorised access to preserve their current access;
new organisations get no automatic grants. Tenant ownership still applies.
Document/version/chunk IDs, live/review states, embedding vectors, legacy types
and S3 keys are preserved. No re-embedding or object migration is required.

Use a maintenance window or stop Knowledge writes/workers during migration.
The new list-function signature and policies require the matching backend.
Apply migrations, deploy/restart the backend, then deploy the portal. Restart
workers after verification. Do not deploy an older backend over this schema;
use a forward fix or restore the pre-migration database backup if rollback is
required. Audit grants/moves and check representative legacy downloads before
opening access. The existing EC2 IAM template already permits the storage
bucket; narrower custom policies must include `knowledge/*` alongside legacy
prefixes. Keep S3 Block Public Access enabled.

## Verification

- `npm test -- --runInBand`: backend unit/HTTP tests.
- `npm run test:knowledge`: isolated PostgreSQL/PGlite + pgvector migrations and
  repository/RLS integration tests. Uses no configured database or AWS account.
- Root `npm test`, `npx tsc --noEmit`, `npm run build`: portal checks.

Integration checks cover cross-brand denial for browsing, direct IDs, signed
URLs, keyword/vector search, machine manuals, AI sources/history, revocation,
platform access, category moves, legacy files/embeddings, category constraints,
manual model links, inactive brands, version keys and review state.
