# aiAssistant

## Purpose

The technician-facing AI assistant API (`/ai`, needs `ai.use`). For each question it:

1. Gathers context: the thread's history, the machine and its recent service history, the live system prompt, and the closest knowledge chunks.
2. Streams Claude's answer as server-sent events.
3. Saves the question, the answer, its sources, usage and any review flag in one transaction.

## Folder structure

```
aiAssistant/
├── aiAssistant.controller.ts   ← POST /ai/ask (SSE), GET /ai/conversations[/:id]
├── aiAssistant.module.ts
├── aiAskContext.service.ts     ← thread/machine/prompt lookup + retrieval, before streaming
├── aiAsk.service.ts            ← streams the answer, then saves it
├── aiConversations.service.ts  ← Threads rail + saved messages
├── aiConversations.repository.ts / aiAnswer.repository.ts ← reads / writes (raw SQL)
├── aiAssistantMapper.ts        ← rows → response shapes, thread titles
├── findCitedIndexes.ts         ← which [n] an answer cites
├── formatMachineContext.ts     ← machine + history as prompt text
├── openEventStream.ts          ← text/event-stream writer with client-abort signal
├── dto/, types/
```

## How to run locally

Runs inside the API (`npm run start:dev` in `backend/`). Unit tests: `npx jest src/aiAssistant`.

## Key conventions

- Threads belong to the technician who started them (`user_id`), within their tenant.
- Only completed answers are saved. A failed or abandoned stream leaves nothing behind, so the technician can ask again.
- A new thread's id is generated up front and sent in the `start` event. The row is written only when the answer completes.
- Answers that cite no source go to the admin review queue (`no_source`).

## Environment variables required

None of its own; see `src/bedrock/README.md` and knowledge indexing (`BEDROCK_EMBEDDING_MODEL_ID`).
