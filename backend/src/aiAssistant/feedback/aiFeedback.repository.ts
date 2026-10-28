import { PoolClient } from 'pg';

export interface RatedAnswerRow {
  id: string;
  // The question it answered, for the "AI answer flagged" alert.
  question: string | null;
}

// Run inside withTenant(caller). An answer can only be rated by the person
// whose thread it's in, while the thread hasn't been cleared.
export const findOwnAnswer = async (
  client: PoolClient,
  params: { tenantId: string; userId: string; messageId: string },
): Promise<RatedAnswerRow | null> => {
  const result = await client.query<RatedAnswerRow>(
    `SELECT m.id,
            (SELECT q.content FROM ai_messages q
             WHERE q.conversation_id = m.conversation_id AND q.role = 'user'
               AND q.created_at <= m.created_at
             ORDER BY q.created_at DESC, q.id DESC LIMIT 1) AS question
     FROM ai_messages m
     JOIN ai_conversations c ON c.id = m.conversation_id
     WHERE m.id = $1 AND m.tenant_id = $2 AND m.role = 'assistant'
       AND c.user_id = $3 AND c.deleted_at IS NULL`,
    [params.messageId, params.tenantId, params.userId],
  );
  return result.rows[0] ?? null;
};

export const insertFeedback = async (
  client: PoolClient,
  params: {
    tenantId: string;
    messageId: string;
    rating: string;
    comment: string | null;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO ai_feedback (tenant_id, message_id, rating, comment)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [params.tenantId, params.messageId, params.rating, params.comment],
  );
  return result.rows[0].id;
};

// A review item still waiting on an admin, so a second "wrong" doesn't
// queue the same answer twice.
export const findOpenReviewItem = async (
  client: PoolClient,
  messageId: string,
): Promise<string | null> => {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM ai_review_items
     WHERE message_id = $1 AND status IN ('unreviewed', 'in_review')
     ORDER BY created_at LIMIT 1`,
    [messageId],
  );
  return result.rows[0]?.id ?? null;
};
