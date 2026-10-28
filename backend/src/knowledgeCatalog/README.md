# knowledgeCatalog

## Purpose

The mobile app's Knowledge reader, alongside the brand-scoped Knowledge API in [`knowledgeBrands`](../knowledgeBrands/README.md) (brand list, document list and detail, admin brands/categories/metadata). This module adds what the app's reader needs on top: one brand or category with its categories, models and types; page-level search with section ids such as `4.3`; facets; a document's table of contents and last-viewed page; reading page by page; downloading the live file for offline use; recent documents and documents for the fleet's machines. Admins (`knowledge.publish`) also get documents in every state, an attention queue and approve/archive.

Visibility: the organisation's own documents plus the shared QuipTech library, limited by `knowledge_can_read_document` (active brands only; migrations 0086, 0093). Non-admins only ever see **live** documents. Anything the caller can't read returns **404**, so ids give nothing away.

## Endpoints

| Route | Who | Notes |
| --- | --- | --- |
| `GET /knowledge/brands/:id` | any | 404 unknown or inactive; categories (with `parentId`), models, types |
| `GET /knowledge/categories/:id` | any | 404 when its brand can't be read; `parentId`, models, types |
| `GET /knowledge/search/pages` | any | `q brandId categoryId type model page pageSize`; one hit per page with `page`, `sectionId`, `<mark>` snippet |
| `GET /knowledge/facets` | any | `brandId categoryId` narrow categories/models/types |
| `GET /knowledge/documents/:id/contents` | any | Table of contents + summary + `lastViewedPage` |
| `GET /knowledge/documents/:id/pages/:n` | any | Page text, sections on the page, `imageUrl`, `pdfUrl#page=n` |
| `GET /knowledge/documents/:id/file` | any | 15-minute signed download; cache by `versionId` |
| `GET/POST /me/knowledge/recent` | any | POST `{ documentId, page? }` → 204 |
| `GET /me/knowledge/for-my-machines` | any | `machineId?` + paging; each document lists `matchedMachines` |
| `GET /machines/:id/manuals` | any | One machine's documents (same shape as for-my-machines) |
| `GET /admin/knowledge/attention` | knowledge.publish | needs review, failed, licence expired/expiring |
| `POST /admin/knowledge/documents/:id/approve` · `/archive` | knowledge.publish | Same rules as `/documents/:id/*` (approving needs platform.manage) |

`GET /knowledge/brands`, `GET /knowledge/documents[/:id]`, `GET /knowledge/search`, brand/category administration and `PATCH /admin/knowledge/documents/:id` (brand, category, type, models) are the `knowledgeBrands` module's. Uploading a new version and deleting use the existing `POST /documents/:id/versions` and `DELETE /documents/:id`.

## Folder structure

```
knowledgeCatalog/
├── catalogScope.ts             ← the shared `catalog` CTE: brand, state, shown version + visibility filters
├── catalogDocumentMapper.ts    ← rows → API shapes
├── access/                     ← who the caller is: Knowledge admin? platform admin? (read per request)
├── brands/                     ← /knowledge/brands/:id, /categories/:id
├── documents/                  ← contents, file + the 404 rule (catalogDocumentAccess.ts)
├── pages/                      ← /documents/:id/pages/:n
├── search/                     ← /knowledge/search/pages (page-level full text), /knowledge/facets
├── facets/                     ← brand/category/model/type counts (also used by brand + category detail)
├── myKnowledge/                ← /me/knowledge/recent, /me/knowledge/for-my-machines
├── admin/                      ← attention, approve/archive
├── dto/
└── types/
```

## How to run locally

Runs inside the API (`npm run start:dev`). Needs migrations `0084`–`0093`, `0102` and `0107` (`db/applyMigrations.sh`).

- Unit tests: `npx jest src/knowledgeCatalog src/knowledge/sectionId src/knowledgeIndexing/pages`
- SQL against a real database (as `field_app`, RLS on): `npm run test:db -- test/knowledgeCatalog.db-spec.ts`

## Key conventions

- **Brand and category** = `documents.brand_id` / `category_id` (`knowledge_brands`, `knowledge_categories`, migration 0084). Every document has both; categories nest within a brand (`parentId`). A brand is not a machine manufacturer: models keep their own manufacturer.
- **Access** is `knowledge_can_read_document` in SQL, never cached: every organisation reads every active brand (0093); inactive brands are platform-admin only.
- **Section ids**: the manual's own number (`4.3`) when the heading has one, else the article anchor `s{ordinal}` (`knowledge/sectionId.ts`, shared with AI citations).
- **Page text** comes from `document_pages`, which the indexer saves from migration 0102 on. Versions indexed earlier fall back to their sections (`textSource: 'sections'`); re-index them to get exact page text. Page images aren't rendered yet (`imageUrl: null`); use `pdfUrl`.
- Every query runs inside `withActor(caller)` (the access check reads `app.user_id`) with the scope also explicit in SQL.

## Environment variables required

None beyond the API's own: `DATABASE_URL`, plus `S3_PORTAL_STORAGE_BUCKET` and `AWS_REGION` for signed links.
