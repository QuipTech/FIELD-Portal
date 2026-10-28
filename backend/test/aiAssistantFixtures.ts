import { Client, PoolClient } from 'pg';
import { DatabaseService } from '../src/database/database.service';
import { KnowledgeBrandFixture } from './isolationFixtures';

export const VECTOR = `[${Array(1024).fill(0.1).join(',')}]`;

// The repositories take a pool client or the DatabaseService; a plain
// Client has the same query(), and withActor sets the same settings.
export const toDatabaseService = (client: Client): DatabaseService =>
  ({
    query: client.query.bind(client),
    withActor: async <T>(
      actor: { tenantId: string; userId: string },
      work: (client: PoolClient) => Promise<T>,
    ): Promise<T> => {
      await client.query(
        "SELECT set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [actor.tenantId, actor.userId],
      );
      return work(client as unknown as PoolClient);
    },
  }) as unknown as DatabaseService;

const insertReturningId = async (
  client: Client,
  sql: string,
  params: unknown[],
) => (await client.query<{ id: string }>(sql, params)).rows[0].id;

// A live shared document of `brand` with one chunk on page 5, in section
// "4.3 Hydraulic pump".
export const seedAiDocument = async (
  client: Client,
  title: string,
  brand: KnowledgeBrandFixture,
) => {
  const itemId = await insertReturningId(
    client,
    `INSERT INTO knowledge_items (tenant_id, title, type, status, source_type)
     VALUES (NULL, $1, 'manual', 'published', 'internal') RETURNING id`,
    [title],
  );
  const documentId = await insertReturningId(
    client,
    `INSERT INTO documents (tenant_id, knowledge_item_id, brand_id, category_id)
     VALUES (NULL, $1, $2, $3) RETURNING id`,
    [itemId, brand.brandId, brand.categoryId],
  );
  const versionId = await insertReturningId(
    client,
    `INSERT INTO document_versions (tenant_id, document_id, file_url, version_number, ingestion_status)
     VALUES (NULL, $1, 'x', 1, 'ready') RETURNING id`,
    [documentId],
  );
  await client.query(
    'UPDATE documents SET live_version_id = $2 WHERE id = $1',
    [documentId, versionId],
  );
  await client.query(
    `INSERT INTO document_sections (document_version_id, ordinal, tenant_id, heading, page_number, content)
     VALUES ($1, 0, NULL, '4.2 Filters', 3, 'x'), ($1, 1, NULL, '4.3 Hydraulic pump', 5, 'y')`,
    [versionId],
  );
  const chunkId = await insertReturningId(
    client,
    `INSERT INTO document_chunks (tenant_id, document_id, document_version_id, chunk_text,
                                  embedding, page_number, section_heading, chunk_index)
     VALUES (NULL, $1, $2, 'Check the pump.', $3::vector, 5, NULL, 0) RETURNING id`,
    [documentId, versionId, VECTOR],
  );
  return { itemId, chunkId };
};
