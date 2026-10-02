import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { MACHINE_LABEL_SQL } from '../machineFleet/machineFleet.repository';
import {
  ConversationRow,
  LivePromptRow,
  MessageRow,
  MessageSourceRow,
} from './types/aiAssistantRows';

const THREAD_LIST_LIMIT = 50;

// Threads are private to the technician who started them. Every query
// filters on tenant_id as well as relying on RLS, since the backend's
// database role may bypass RLS.
const CONVERSATION_COLUMNS = `
  c.id, c.title, c.machine_id, c.updated_at,
  CASE WHEN m.id IS NULL THEN NULL ELSE ${MACHINE_LABEL_SQL} END AS machine_label`;

const CONVERSATION_FROM = `
  FROM ai_conversations c
  LEFT JOIN machines m ON m.id = c.machine_id AND m.tenant_id = c.tenant_id`;

export const listConversations = async (
  client: PoolClient,
  params: { tenantId: string; userId: string },
): Promise<ConversationRow[]> => {
  const result = await client.query<ConversationRow>(
    `SELECT ${CONVERSATION_COLUMNS} ${CONVERSATION_FROM}
     WHERE c.tenant_id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL
     ORDER BY c.updated_at DESC
     LIMIT ${THREAD_LIST_LIMIT}`,
    [params.tenantId, params.userId],
  );
  return result.rows;
};

export const findConversation = async (
  client: PoolClient,
  params: { tenantId: string; userId: string; conversationId: string },
): Promise<ConversationRow | null> => {
  const result = await client.query<ConversationRow>(
    `SELECT ${CONVERSATION_COLUMNS} ${CONVERSATION_FROM}
     WHERE c.id = $1 AND c.tenant_id = $2 AND c.user_id = $3
       AND c.deleted_at IS NULL`,
    [params.conversationId, params.tenantId, params.userId],
  );
  return result.rows[0] ?? null;
};

export const listMessages = async (
  client: PoolClient,
  params: { tenantId: string; conversationId: string },
): Promise<MessageRow[]> => {
  const result = await client.query<MessageRow>(
    `SELECT id, role, content, created_at FROM ai_messages
     WHERE conversation_id = $1 AND tenant_id = $2
     ORDER BY created_at, id`,
    [params.conversationId, params.tenantId],
  );
  return result.rows;
};

// Sources come from the tenant's documents and the shared library, whose
// chunks have no tenant_id, so this reads outside the tenant's RLS scope
// (like knowledge search) and scopes by the reference's tenant instead.
export const listMessageSources = async (
  databaseService: DatabaseService,
  params: { tenantId: string; conversationId: string },
): Promise<MessageSourceRow[]> => {
  const result = await databaseService.query<MessageSourceRow>(
    `SELECT r.message_id, r.chunk_id, ki.id AS document_id, ki.title,
            r.page_number, r.section_heading
     FROM ai_source_references r
     JOIN ai_messages msg ON msg.id = r.message_id
     LEFT JOIN document_chunks c ON c.id = r.chunk_id
     LEFT JOIN documents d ON d.id = c.document_id AND d.deleted_at IS NULL
     LEFT JOIN knowledge_items ki ON ki.id = d.knowledge_item_id
                                 AND ki.deleted_at IS NULL
     WHERE msg.conversation_id = $1 AND r.tenant_id = $2
     ORDER BY r.message_id, r.created_at, r.id`,
    [params.conversationId, params.tenantId],
  );
  return result.rows;
};

// The platform-wide prompt published in Admin → AI configuration.
export const findLivePrompt = async (
  client: PoolClient,
): Promise<LivePromptRow | null> => {
  const result = await client.query<LivePromptRow>(
    `SELECT version_number, body FROM ai_prompt_versions WHERE is_live LIMIT 1`,
  );
  return result.rows[0] ?? null;
};
