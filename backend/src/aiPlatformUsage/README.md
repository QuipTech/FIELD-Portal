# aiPlatformUsage

## Purpose

Records Amazon Bedrock usage that isn't a technician's answer: prompt **Test** runs, document indexing (Titan embeddings) and search-query embeddings. Each call writes one row to `ai_platform_usage_log` (migration `0063`) with its tokens and an estimated cost. Admin → AI configuration shows the totals next to the assistant figures. Technician answers are logged separately, in `ai_usage_log`, by `src/aiAssistant`.

## Folder structure

```
aiPlatformUsage/
├── aiPlatformUsage.module.ts      ← global; exports AiPlatformUsageService
├── aiPlatformUsage.service.ts     ← recordUsage: prices the call and stores it, never throws
├── aiPlatformUsage.repository.ts  ← calls record_ai_platform_usage()
└── types/aiPlatformUsageEntry.ts  ← source, tenant, model and token counts
```

## How to run locally

Runs inside the API (`npm run start:dev` in `backend/`). Apply migration `0063_ai_platform_usage.sql` first (see the backend `README.md`, "Running migrations").

## Key conventions

- `recordUsage` logs and swallows its own failures, so usage tracking can never break the feature that made the call.
- `tenantId` is null for platform work (prompt tests, shared-library documents); only the Owner sees those rows.
- Costs come from `src/bedrock/estimateBedrockCost.ts` and are estimates. AWS billing is the source of truth, and failed calls and retries aren't recorded.

## Environment variables required

None beyond the API's `DATABASE_URL`.
