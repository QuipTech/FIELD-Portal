import { PoolClient } from 'pg';

// Everything that is about one person, as JSON. Runs under withTenant()
// (RLS) and filters by user. The organisation's machines, snapshots and
// knowledge are company data and are not included — only this user's own
// entries on them.
const USER_DATA_QUERIES: Record<string, string> = {
  profile: `SELECT id, email, first_name, last_name, phone_number, status, auth_provider,
              created_at, last_login_at
            FROM users WHERE id = $1`,
  roles: `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
  historyEntries: `SELECT h.id, h.machine_id, m.serial_number AS machine_serial, h.entry_type,
                     h.description, h.is_amendment, h.created_at
                   FROM technical_history_entries h
                   JOIN machines m ON m.id = h.machine_id
                   WHERE h.created_by = $1 AND h.deleted_at IS NULL
                   ORDER BY h.created_at`,
  uploadedPhotos: `SELECT id, history_entry_id, file_name, content_type, size_bytes, created_at
                   FROM technical_attachments
                   WHERE uploaded_by = $1 AND deleted_at IS NULL ORDER BY created_at`,
  caseActivity: `SELECT u.id, u.support_case_id, c.subject AS case_subject, u.note, u.created_at
                 FROM support_updates u JOIN support_cases c ON c.id = u.support_case_id
                 WHERE u.created_by = $1 ORDER BY u.created_at`,
  aiConversations: `SELECT c.id, c.title, c.created_at,
                      COALESCE((SELECT json_agg(json_build_object('role', m.role, 'content', m.content,
                        'createdAt', m.created_at) ORDER BY m.created_at)
                        FROM ai_messages m WHERE m.conversation_id = c.id), '[]'::json) AS messages
                    FROM ai_conversations c WHERE c.user_id = $1 AND c.deleted_at IS NULL
                    ORDER BY c.created_at`,
  sessions: `SELECT created_at, expires_at, device_info FROM sessions WHERE user_id = $1 ORDER BY created_at`,
  activity: `SELECT action, entity_type, entity_id, created_at FROM audit_logs
             WHERE user_id = $1 ORDER BY created_at`,
};

export const collectUserData = async (
  client: PoolClient,
  userId: string,
): Promise<Record<string, unknown>> => {
  const sections: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
  };
  for (const [section, sql] of Object.entries(USER_DATA_QUERIES)) {
    const result = await client.query(sql, [userId]);
    sections[section] =
      section === 'profile' ? (result.rows[0] ?? null) : result.rows;
  }
  return sections;
};
