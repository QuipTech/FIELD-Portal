import { PoolClient } from 'pg';
import { RetrievedChunk } from '../bedrock/types/technicalResponse';

// Writes for one answered question. All run inside the caller's
// withTenant transaction; tenant_id is always set explicitly.

export const insertConversation = async (
  client: PoolClient,
  params: {
    id: string;
    tenantId: string;
    userId: string;
    machineId: string | null;
    title: string;
  },
): Promise<void> => {
  await client.query(
    `INSERT INTO ai_conversations (id, tenant_id, user_id, machine_id, title)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.id, params.tenantId, params.userId, params.machineId, params.title],
  );
};

// Moves the thread to the top of the Threads list.
export const touchConversation = async (
  client: PoolClient,
  params: { tenantId: string; conversationId: string },
): Promise<void> => {
  await client.query(
    `UPDATE ai_conversations SET updated_at = now()
     WHERE id = $1 AND tenant_id = $2`,
    [params.conversationId, params.tenantId],
  );
};

// clock_timestamp(), not now(): the question and its answer are written
// in one transaction and must still sort question-first.
export const insertMessage = async (
  client: PoolClient,
  params: {
    tenantId: string;
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    modelUsed?: string;
    promptVersion?: string;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO ai_messages
       (tenant_id, conversation_id, role, content, model_used, prompt_version, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp())
     RETURNING id`,
    [
      params.tenantId,
      params.conversationId,
      params.role,
      params.content,
      params.modelUsed ?? null,
      params.promptVersion ?? null,
    ],
  );
  return result.rows[0].id;
};

// Every excerpt the answer was given, in prompt order, so the [n] in the
// stored answer still points at the right source when the thread reloads.
export const insertSourceReferences = async (
  client: PoolClient,
  params: { tenantId: string; messageId: string; chunks: RetrievedChunk[] },
): Promise<void> => {
  if (!params.chunks.length) return;
  await client.query(
    `INSERT INTO ai_source_references
       (tenant_id, message_id, chunk_id, page_number, section_heading, created_at)
     SELECT $1, $2, source.chunk_id, source.page_number, source.section_heading,
            clock_timestamp() + source.position * interval '1 microsecond'
     FROM unnest($3::uuid[], $4::integer[], $5::varchar[])
          WITH ORDINALITY AS source(chunk_id, page_number, section_heading, position)`,
    [
      params.tenantId,
      params.messageId,
      params.chunks.map((chunk) => chunk.chunkId),
      params.chunks.map((chunk) => chunk.page),
      params.chunks.map((chunk) => chunk.heading),
    ],
  );
};

export const insertUsageLog = async (
  client: PoolClient,
  params: {
    tenantId: string;
    userId: string;
    messageId: string;
    tokensUsed: number;
    costEstimate: number;
  },
): Promise<void> => {
  await client.query(
    `INSERT INTO ai_usage_log (tenant_id, user_id, message_id, tokens_used, cost_estimate)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      params.tenantId,
      params.userId,
      params.messageId,
      params.tokensUsed,
      params.costEstimate,
    ],
  );
};

// Sends an answer to the admin review queue (migration 0041's reasons).
export const insertReviewItem = async (
  client: PoolClient,
  params: {
    tenantId: string;
    messageId: string;
    reasonCode: 'no_source';
    reason: string;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO ai_review_items (tenant_id, message_id, reason_code, reason)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [params.tenantId, params.messageId, params.reasonCode, params.reason],
  );
  return result.rows[0].id;
};
