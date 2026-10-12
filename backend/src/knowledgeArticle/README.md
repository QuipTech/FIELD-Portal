# knowledgeArticle

## Purpose

`GET /documents/:id/article` — a live document as a readable article for the portal's `/knowledge/:id` page: title, tags (type, machine model, revision, source), summary, sections with headings, pages and figure captions, related documents and the bulletins that apply. Only the caller's organisation's documents and the shared QuipTech library are visible (404 otherwise); a document that isn't live yet answers 409 `{ state, progress }`.

## Folder structure

```
knowledgeArticle/
├── knowledgeArticle.controller.ts     ← GET /documents/:documentId/article
├── knowledgeArticle.service.ts        ← assembles the article, signs the inline PDF link
├── knowledgeArticle.repository.ts     ← the document + live version, saved sections/figures, chunks
├── relatedDocuments.repository.ts     ← same-model documents by embedding similarity; applicable bulletins
├── loadArticleSections.ts             ← saved sections, or rebuilt from chunks and backfilled
├── articleAvailability.ts             ← why an article can't be shown yet (409)
├── articleSummary.ts                  ← saved AI summary, else section 1's first paragraph
└── types/
```

Sections are built by `knowledgeIndexing/sections/` (shared with the indexer).

## How to run locally

Runs inside the API (`npm run start:dev`). Needs migration `0076`. Tests: `npx jest src/knowledgeArticle src/knowledgeIndexing/sections`.

## Key conventions

- Sections come from what the indexer extracted (`document_sections`), not from the search chunks: chunks are ~900 tokens and keep only their first heading. Versions indexed before migration 0076 are rebuilt from their chunks the first time they're opened, and saved.
- Section anchors are `s{ordinal}`; the Knowledge search returns the best-matching one as `sectionId`.
- Figures have no page images yet (`imageUrl: null`); the portal shows a captioned placeholder.

## Environment variables required

None beyond the API's own (`DATABASE_URL`, `S3_PORTAL_STORAGE_BUCKET`, `AWS_REGION` for the signed PDF link).
