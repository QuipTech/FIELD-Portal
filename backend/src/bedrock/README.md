# bedrock

## Purpose

Calls Claude on Amazon Bedrock for technician answers. `BedrockService.generateTechnicalResponse` takes a question, its retrieved chunks, an optional photo and the thread's history. It streams the answer through `InvokeModelWithResponseStream` and returns the full text with token usage. The module knows nothing about tenants, retrieval or the database; the caller handles those (see `src/aiAssistant`).

## Folder structure

```
bedrock/
├── bedrock.module.ts            ← exports BedrockService
├── bedrock.service.ts           ← generateTechnicalResponse (stream + retry + safe errors)
├── bedrockConfig.ts             ← region, Sonnet/Haiku ids, routing thresholds (env)
├── buildTechnicalRequestBody.ts ← Messages API body: system, history, image + text blocks
├── readBedrockStream.ts         ← decodes stream chunks into text deltas + usage
├── selectModelTier.ts           ← Haiku vs Sonnet decision
├── retryBedrockCall.ts          ← shared retry policy (also used by the embedder)
├── toAssistantHttpError.ts      ← AWS errors → generic 429/503/502 messages
├── estimateBedrockCost.ts       ← approximate USD per Bedrock call (ai_usage_log, ai_platform_usage_log)
├── technicalAssistantPrompt.ts  ← built-in system prompt (fallback to the published one)
└── types/technicalResponse.ts
```

## How to run locally

Runs inside the API (`npm run start:dev` in `backend/`). Unit tests: `npx jest src/bedrock`.

## Key conventions

- Retries stop once any text has been passed to `onText`, so a technician never sees a repeated answer.
- Never return AWS error names or messages to callers. Log them and throw via `toAssistantHttpError`.
- Retrieved chunks are numbered `[n]` in prompt order. Callers store them in that order, so the citations still resolve when a thread reloads.

## Environment variables required

`BEDROCK_REGION` / `AWS_REGION`, `BEDROCK_ANSWER_MODEL_ID`, `BEDROCK_LIGHT_MODEL_ID`, `BEDROCK_BACKGROUND_MODEL_ID`, `BEDROCK_LIGHT_ROUTING_ENABLED`, `BEDROCK_LIGHT_MAX_QUESTION_CHARS`, `BEDROCK_LIGHT_MAX_CONTEXT_CHARS`, `BEDROCK_LIGHT_MAX_HISTORY_MESSAGES`, `BEDROCK_ANSWER_MAX_TOKENS`. AWS credentials come from the default provider chain.
