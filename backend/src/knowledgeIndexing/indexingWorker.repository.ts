import { DatabaseService } from '../database/database.service';
import { MachineModelRef } from './machineModelDetection';

export interface IndexingJob {
  version_id: string;
  document_id: string;
  knowledge_item_id: string;
  tenant_id: string | null;
  item_type: string;
  title: string;
  storage_key: string;
  content_type: string;
  // bigint arrives from pg as a string.
  size_bytes: string | null;
}

export type IndexingStage = 'parsing' | 'chunking' | 'embedding';

// All worker writes go through SECURITY DEFINER functions (migrations
// 0036/0037): the worker runs outside any request, across shared and
// tenant documents, and those functions also write the audit log.

export const claimNextJob = async (
  databaseService: DatabaseService,
  staleMinutes: number,
): Promise<IndexingJob | null> => {
  const result = await databaseService.query<IndexingJob>(
    `SELECT * FROM claim_next_indexing_job($1)`,
    [staleMinutes],
  );
  return result.rows[0] ?? null;
};

// False once the job was deleted or reset meanwhile — stop working on it.
export const setProgress = async (
  databaseService: DatabaseService,
  params: { versionId: string; stage: IndexingStage; progress: number },
): Promise<boolean> => {
  const result = await databaseService.query<{ ok: boolean }>(
    `SELECT set_indexing_progress($1, $2, $3) AS ok`,
    [params.versionId, params.stage, Math.round(params.progress)],
  );
  return result.rows[0].ok;
};

export const insertChunks = async (
  databaseService: DatabaseService,
  params: {
    versionId: string;
    firstIndex: number;
    chunks: {
      page: number | null;
      heading: string | null;
      content: string;
      embedding: string;
    }[];
  },
): Promise<void> => {
  const { chunks } = params;
  await databaseService.query(
    `SELECT insert_document_chunks($1, $2, $3, $4, $5, $6)`,
    [
      params.versionId,
      params.firstIndex,
      chunks.map((chunk) => chunk.page),
      chunks.map((chunk) => chunk.heading),
      chunks.map((chunk) => chunk.content),
      chunks.map((chunk) => chunk.embedding),
    ],
  );
};

export const listMachineModels = async (
  databaseService: DatabaseService,
): Promise<MachineModelRef[]> => {
  const result = await databaseService.query<MachineModelRef>(
    `SELECT mm.id, mm.name, mf.name AS manufacturer
     FROM machine_models mm
     JOIN machine_manufacturers mf ON mf.id = mm.manufacturer_id AND mf.deleted_at IS NULL
     WHERE mm.deleted_at IS NULL`,
  );
  return result.rows;
};

export const linkMachineModels = async (
  databaseService: DatabaseService,
  params: { itemId: string; matches: { modelId: string; mentions: number }[] },
): Promise<void> => {
  await databaseService.query(
    `SELECT link_document_machine_models($1, $2, $3)`,
    [
      params.itemId,
      params.matches.map((match) => match.modelId),
      params.matches.map((match) => match.mentions),
    ],
  );
};

// 'live' | 'needs_review', or null when the job was cancelled meanwhile.
export const completeIndexing = async (
  databaseService: DatabaseService,
  params: { versionId: string; pageCount: number | null },
): Promise<string | null> => {
  const result = await databaseService.query<{ state: string | null }>(
    `SELECT complete_indexing($1, $2) AS state`,
    [params.versionId, params.pageCount],
  );
  return result.rows[0].state;
};

export const failIndexing = async (
  databaseService: DatabaseService,
  params: { versionId: string; message: string },
) => {
  await databaseService.query(`SELECT fail_indexing($1, $2)`, [
    params.versionId,
    params.message,
  ]);
};
