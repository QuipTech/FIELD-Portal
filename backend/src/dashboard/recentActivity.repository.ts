import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { MACHINE_LABEL_SQL } from '../machineFleet/machineFleet.repository';
import {
  CaseActivityRow,
  EntryActivityRow,
  KnowledgeActivityRow,
  ThreadActivityRow,
} from './types/dashboardRows';

// Each source returns its newest few; the service merges them by time.
export const ACTIVITY_LIMIT = 6;

const machineLabel = `CASE WHEN m.id IS NULL THEN NULL ELSE ${MACHINE_LABEL_SQL} END`;

export const listCaseActivity = async (
  client: PoolClient,
  tenantId: string,
): Promise<CaseActivityRow[]> => {
  const result = await client.query<CaseActivityRow>(
    `SELECT c.case_number, c.subject, c.status, c.priority, c.updated_at,
            ${machineLabel} AS machine_label
     FROM support_cases c
     LEFT JOIN machines m ON m.id = c.machine_id AND m.tenant_id = c.tenant_id
     WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
     ORDER BY c.updated_at DESC
     LIMIT ${ACTIVITY_LIMIT}`,
    [tenantId],
  );
  return result.rows;
};

export const listEntryActivity = async (
  client: PoolClient,
  tenantId: string,
): Promise<EntryActivityRow[]> => {
  const result = await client.query<EntryActivityRow>(
    `SELECT e.id, e.machine_id, ${MACHINE_LABEL_SQL} AS machine_label,
            e.entry_type, e.description, e.created_at,
            u.first_name AS author_first_name, u.last_name AS author_last_name
     FROM technical_history_entries e
     JOIN machines m ON m.id = e.machine_id AND m.deleted_at IS NULL
     LEFT JOIN users u ON u.id = e.created_by
     WHERE e.tenant_id = $1 AND e.deleted_at IS NULL
     ORDER BY e.created_at DESC
     LIMIT ${ACTIVITY_LIMIT}`,
    [tenantId],
  );
  return result.rows;
};

// The caller's own assistant threads (they're private), with the latest
// answer and how many sources it was given.
export const listThreadActivity = async (
  client: PoolClient,
  params: { tenantId: string; userId: string },
): Promise<ThreadActivityRow[]> => {
  const result = await client.query<ThreadActivityRow>(
    `SELECT c.id, c.title, c.updated_at, ${machineLabel} AS machine_label,
            answer.content AS latest_answer,
            COALESCE(answer.source_count, 0) AS source_count
     FROM ai_conversations c
     LEFT JOIN machines m ON m.id = c.machine_id AND m.tenant_id = c.tenant_id
     LEFT JOIN LATERAL (
       SELECT msg.content,
              (SELECT count(*) FROM ai_source_references r
               WHERE r.message_id = msg.id) AS source_count
       FROM ai_messages msg
       WHERE msg.conversation_id = c.id AND msg.role = 'assistant'
       ORDER BY msg.created_at DESC
       LIMIT 1
     ) answer ON true
     WHERE c.tenant_id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL
     ORDER BY c.updated_at DESC
     LIMIT ${ACTIVITY_LIMIT}`,
    [params.tenantId, params.userId],
  );
  return result.rows;
};

// Documents now live in Knowledge: the organisation's own and the shared
// library's, which has no tenant_id, so this reads outside the tenant's
// RLS scope (like knowledge search) and filters explicitly.
export const listKnowledgeActivity = async (
  databaseService: DatabaseService,
  tenantId: string,
): Promise<KnowledgeActivityRow[]> => {
  const result = await databaseService.query<KnowledgeActivityRow>(
    `SELECT ki.id, ki.title, ki.type, ki.tenant_id IS NULL AS is_shared,
            ki.created_at
     FROM knowledge_items ki
     JOIN documents d ON d.knowledge_item_id = ki.id AND d.deleted_at IS NULL
                     AND d.live_version_id IS NOT NULL
     WHERE (ki.tenant_id IS NULL OR ki.tenant_id = $1)
       AND ki.deleted_at IS NULL AND ki.status <> 'archived'
     ORDER BY ki.created_at DESC
     LIMIT ${ACTIVITY_LIMIT}`,
    [tenantId],
  );
  return result.rows;
};
