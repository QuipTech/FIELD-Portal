# knowledgeCatalog

## Purpose

The mobile app's Knowledge section. Users browse the brands in their organisation's plan, then each brand's categories and models. They can list and search documents, read a document page by page with section ids such as `4.3`, download the live file for offline use, and get back to recent documents or documents for the fleet's machines. Admins (`knowledge.publish`) also get counts, documents in every state, an attention queue, approve/archive, document classification and brand access.

Visibility: the organisation's own documents plus the shared QuipTech library. Non-admins only ever see **live** documents. A brand outside the plan is hidden from lists, and opening it directly returns **403**. Anything the caller can't see returns **404**, so document ids give nothing away.

## Endpoints

| Route | Who | Notes |
| --- | --- | --- |
| `GET /knowledge/brands` | any | Plan brands with document/category/machine counts; `admin` block (in review, sites, active users) for admins |
| `GET /knowledge/brands/:id` | any | 404 unknown, 403 not in plan; categories, models, types |
| `GET /knowledge/categories/:id` | any | 403 when its brand isn't in the plan |
| `GET /knowledge/documents` | any | `brandId categoryId type model status sort page pageSize`; `status` admins only |
| `GET /knowledge/search` | any | `q` + the same filters; one hit per page with `page`, `sectionId`, `<mark>` snippet |
| `GET /knowledge/facets` | any | `brandId categoryId` narrow categories/models/types |
| `GET /knowledge/documents/:id` | any | Detail + table of contents + `lastViewedPage` |
| `GET /knowledge/documents/:id/pages/:n` | any | Page text, sections on the page, `imageUrl`, `pdfUrl#page=n` |
| `GET /knowledge/documents/:id/file` | any | 15-minute signed download; cache by `versionId` |
| `GET/POST /me/knowledge/recent` | any | POST `{ documentId, page? }` → 204 |
| `GET /me/knowledge/for-my-machines` | any | `machineId?` + paging; each document lists `matchedMachines` |
| `GET /admin/knowledge/attention` | knowledge.publish | needs review, failed, licence expired/expiring |
| `POST /admin/knowledge/documents/:id/approve` · `/archive` | knowledge.publish | Same rules as `/documents/:id/*` (approving needs platform.manage) |
| `PATCH /admin/knowledge/documents/:id/classification` | knowledge.publish | `{ brandId, categoryId }`, null clears |
| `GET /admin/knowledge/brand-access` | knowledge.publish | The caller's organisation |
| `PUT /admin/knowledge/brand-access/:tenantId` | platform.manage | `{ isRestricted, brandIds }` |
| `POST/PATCH/DELETE /admin/knowledge/categories[/:id]` | platform.manage | Per-brand categories |

Uploading a new version and deleting use the existing `POST /documents/:id/versions` and `DELETE /documents/:id` (or the Owner's `/admin/knowledge/...` upload flow).

## Folder structure

```
knowledgeCatalog/
├── catalogScope.ts             ← the shared `catalog` CTE: brand, state, shown version + visibility filters
├── catalogDocumentMapper.ts    ← rows → API shapes
├── access/                     ← who the caller is: admin?, the plan's brands (read per request)
├── brands/                     ← /knowledge/brands, /brands/:id, /categories/:id
├── documents/                  ← list, detail, file + the 404/403 rule (catalogDocumentAccess.ts)
├── pages/                      ← /documents/:id/pages/:n
├── search/                     ← /knowledge/search (page-level full text), /knowledge/facets
├── facets/                     ← brand/category/model/type counts (also used by brand + category detail)
├── myKnowledge/                ← /me/knowledge/recent, /me/knowledge/for-my-machines
├── admin/                      ← attention, approve/archive, classification, brand access, categories
├── dto/
└── types/
```

## How to run locally

Runs inside the API (`npm run start:dev`). Needs migration `0102` (`db/applyMigrations.sh`).

- Unit tests: `npx jest src/knowledgeCatalog src/knowledge/sectionId src/knowledgeIndexing/pages`
- SQL against a real database (as `field_app`, RLS on): `npm run test:db -- test/knowledgeCatalog.db-spec.ts`

## Key conventions

- **Brand** = `machine_manufacturers`. A document's brand is `knowledge_items.manufacturer_id` when an admin set one, otherwise the maker of the model it mentions most. Documents without a brand are visible to everyone.
- **Plan**: `tenants.knowledge_brands_restricted` plus `tenant_brand_access`. Unrestricted (the default) means every brand.
- **Section ids**: the manual's own number (`4.3`) when the heading has one, else the article anchor `s{ordinal}` (`knowledge/sectionId.ts`, shared with AI citations).
- **Page text** comes from `document_pages`, which the indexer saves from migration 0102 on. Versions indexed earlier fall back to their sections (`textSource: 'sections'`); re-index them to get exact page text. Page images aren't rendered yet (`imageUrl: null`); use `pdfUrl`.
- Every query runs inside `withTenant(caller)` with the scope also explicit in SQL.

## Environment variables required

None beyond the API's own: `DATABASE_URL`, plus `S3_PORTAL_STORAGE_BUCKET` and `AWS_REGION` for signed links.
