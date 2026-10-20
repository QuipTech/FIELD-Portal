import { PoolClient } from 'pg';

// Internal notes only: customer replies are never edited or deleted.
const LIVE_NOTE = `tenant_id = $1 AND support_case_id = $2 AND id = $3
  AND is_internal AND deleted_at IS NULL`;

interface NoteKey {
  tenantId: string;
  caseId: string;
  noteId: string;
}

// The note's author, or undefined when there's no such live note.
export const findNoteAuthorId = async (
  client: PoolClient,
  key: NoteKey,
): Promise<string | null | undefined> => {
  const result = await client.query<{ created_by: string | null }>(
    `SELECT created_by FROM support_updates WHERE ${LIVE_NOTE}`,
    [key.tenantId, key.caseId, key.noteId],
  );
  return result.rows[0]?.created_by;
};

export const updateNoteBody = async (
  client: PoolClient,
  key: NoteKey & { body: string },
): Promise<void> => {
  await client.query(
    `UPDATE support_updates SET note = $4, edited_at = now(), updated_at = now()
     WHERE ${LIVE_NOTE}`,
    [key.tenantId, key.caseId, key.noteId, key.body],
  );
};

export const softDeleteNote = async (
  client: PoolClient,
  key: NoteKey,
): Promise<void> => {
  await client.query(
    `UPDATE support_updates SET deleted_at = now(), updated_at = now()
     WHERE ${LIVE_NOTE}`,
    [key.tenantId, key.caseId, key.noteId],
  );
};
