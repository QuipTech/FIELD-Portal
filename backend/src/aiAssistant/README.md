# aiAssistant

## Purpose

The technician-facing AI assistant API (`/ai`, needs `ai.use`). For each question it:

1. Gathers context: the thread's history, the machine and its recent service history, the live system prompt, and the closest knowledge chunks.
2. Streams Claude's answer as server-sent events.
3. Saves the question, the answer, its sources, usage and any review flag in one transaction.

## Folder structure

```
aiAssistant/
├── aiAssistant.controller.ts   ← POST /ai/ask (SSE), GET/DELETE /ai/conversations[/:id],
│                                  POST /ai/messages/:id/feedback, GET /ai/usage
├── aiAssistant.module.ts
├── aiAskContext.service.ts     ← thread/machine/prompt lookup + retrieval, before streaming
├── aiRetrieval.service.ts      ← checks a document/brand/category scope (404), then retrieves sources
├── aiAsk.service.ts            ← streams the answer, then saves it
├── feedback/                   ← "helpful"/"wrong" ratings; wrong → review queue (marked_wrong)
├── usage/                      ← this month's questions vs personal and organisation allowance
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
- Answers that cite no source go to the admin review queue (`no_source`). Answers rated "wrong" go there as `marked_wrong`, once per open item. Admins resolve or escalate them with `PATCH /admin/ai/reviewQueue/:id { status }`.
- Scope per question: `machineId` (new threads), `documentId`, `brandId` or `categoryId`. A scoped question leaves out the thread's earlier messages. Retrieval always keeps to what the caller may read (`knowledge_can_read_document`, see [`knowledgeBrands`](../knowledgeBrands/README.md)), and every source carries its `sectionId`.
- Every source carries `documentId` (the knowledge item), `page` and `sectionId` ("4.3", else `s{ordinal}`), for live answers and saved threads alike.
- Clearing a thread (`DELETE /ai/conversations[/:id]`) hides it. Its messages stay for usage and the review queue.
- Usage: organisation allowance from the `ai_assistant` entitlement; the personal figure is a TECH seat's share (`billing.config` `AI_ALLOWANCE_PER_TECH_USER`, pooled). Nothing is blocked when an allowance runs out.

## Environment variables required

None of its own; see `src/bedrock/README.md` and knowledge indexing (`BEDROCK_EMBEDDING_MODEL_ID`).
