import 'reflect-metadata';
import { Client, PoolClient } from 'pg';
import { buildPoolConfig } from '../src/database/buildPoolConfig';
import { DatabaseService } from '../src/database/database.service';
import { readDatabaseUrl } from './dbTestConnection';
import { asTenantRole, insertTenant } from './isolationFixtures';
import { searchLiveChunks } from '../src/knowledgeSearch/knowledgeSearch.repository';
import * as conversations from '../src/aiAssistant/aiConversations.repository';
import * as feedback from '../src/aiAssistant/feedback/aiFeedback.repository';
import { insertReviewItem } from '../src/aiAssistant/aiAnswer.repository';
import { countAiQueries } from '../src/aiAssistant/usage/aiUsage.repository';

// The AI assistant's new SQL against a real database (npm run test:db), as
// the tenant role so RLS applies. Fixtures are written as the migration
// owner; everything is rolled back.

const client = new Client(buildPoolConfig(readDatabaseUrl()));
// The repositories take a pool client or the DatabaseService; a plain
// Client has the same query().
const db = client as unknown as PoolClient;
const databaseService = client as unknown as DatabaseService;

const VECTOR = `[${Array(1024).fill(0.1).join(',')}]`;

let tenantA: string;
let userA: string;
let cat: string;
let komatsu: string;
let catDoc: string;
let komatsuDoc: string;
let catChunk: string;
let conversationId: string;
let answerId: string;

const insertReturningId = async (sql: string, params: unknown[]) =>
  (await client.query<{ id: string }>(sql, params)).rows[0].id;

// A live shared document of `brandId` with one chunk on page 5.
const seedDocument = async (title: string, brandId: string) => {
  const itemId = await insertReturningId(
    `INSERT INTO knowledge_items (tenant_id, title, type, status, source_type, manufacturer_id)
     VALUES (NULL, $1, 'manual', 'published', 'internal', $2) RETURNING id`,
    [title, brandId],
  );
  const documentId = await insertReturningId(
    'INSERT INTO documents (tenant_id, knowledge_item_id) VALUES (NULL, $1) RETURNING id',
    [itemId],
  );
  const versionId = await insertReturningId(
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
    `INSERT INTO document_chunks (tenant_id, document_id, document_version_id, chunk_text,
                                  embedding, page_number, section_heading, chunk_index)
     VALUES (NULL, $1, $2, 'Check the pump.', $3::vector, 5, NULL, 0) RETURNING id`,
    [documentId, versionId, VECTOR],
  );
  return { itemId, chunkId };
};

beforeAll(() => client.connect());
afterAll(() => client.end());

beforeEach(async () => {
  await client.query('BEGIN');
  tenantA = await insertTenant(client, 'ai-a');
  userA = await insertReturningId(
    `INSERT INTO users (tenant_id, email, first_name, last_name, cognito_sub)
     VALUES ($1, $2, 'Tess', 'Tech', $2) RETURNING id`,
    [tenantA, `ai-${Date.now()}@example.com`],
  );
  const suffix = Date.now();
  cat = await insertReturningId(
    'INSERT INTO machine_manufacturers (name) VALUES ($1) RETURNING id',
    [`CAT ${suffix}`],
  );
  komatsu = await insertReturningId(
    'INSERT INTO machine_manufacturers (name) VALUES ($1) RETURNING id',
    [`Komatsu ${suffix}`],
  );
  const catSeed = await seedDocument('CAT manual', cat);
  catDoc = catSeed.itemId;
  catChunk = catSeed.chunkId;
  komatsuDoc = (await seedDocument('Komatsu manual', komatsu)).itemId;
  await asTenantRole(client, tenantA);
  await client.query("SELECT set_config('app.user_id', $1, true)", [userA]);
  conversationId = await insertReturningId(
    `INSERT INTO ai_conversations (tenant_id, user_id, title) VALUES ($1, $2, 'Pump') RETURNING id`,
    [tenantA, userA],
  );
  await client.query(
    `INSERT INTO ai_messages (tenant_id, conversation_id, role, content, created_at)
     VALUES ($1, $2, 'user', 'Pump pressure?', now() - interval '1 second')`,
    [tenantA, conversationId],
  );
  answerId = await insertReturningId(
    `INSERT INTO ai_messages (tenant_id, conversation_id, role, content)
     VALUES ($1, $2, 'assistant', 'See [1].') RETURNING id`,
    [tenantA, conversationId],
  );
  await client.query(
    `INSERT INTO ai_source_references (tenant_id, message_id, chunk_id, page_number)
     VALUES ($1, $2, $3, 5)`,
    [tenantA, answerId, catChunk],
  );
});

afterEach(() => client.query('ROLLBACK'));

const search = (scope: { brandId?: string; planBrandIds: string[] | null }) =>
  searchLiveChunks(databaseService, {
    queryVector: VECTOR,
    tenantId: tenantA,
    limit: 10,
    ...scope,
  });

describe('retrieval', () => {
  it('resolves each chunk to the section on its page', async () => {
    const rows = await search({ planBrandIds: null });
    expect(rows.map((row) => row.knowledge_item_id).sort()).toEqual(
      [catDoc, komatsuDoc].sort(),
    );
    expect(rows[0]).toMatchObject({
      section_ordinal: 1,
      section_title: '4.3 Hydraulic pump',
    });
  });

  it('keeps to the plan brands and a chosen brand', async () => {
    const inPlan = await search({ planBrandIds: [komatsu] });
    expect(inPlan.map((row) => row.knowledge_item_id)).toEqual([komatsuDoc]);
    const scoped = await search({ brandId: cat, planBrandIds: null });
    expect(scoped.map((row) => row.knowledge_item_id)).toEqual([catDoc]);
  });
});

describe('conversations', () => {
  it('gives saved sources their section', async () => {
    const sources = await conversations.listMessageSources(databaseService, {
      tenantId: tenantA,
      conversationId,
    });
    expect(sources).toEqual([
      expect.objectContaining({
        document_id: catDoc,
        section_ordinal: 1,
        section_title: '4.3 Hydraulic pump',
      }),
    ]);
  });

  it('clears threads so they no longer list or open', async () => {
    const lookup = { tenantId: tenantA, userId: userA };
    expect(await conversations.softDeleteConversations(db, lookup)).toBe(1);
    expect(await conversations.listConversations(db, lookup)).toEqual([]);
    expect(
      await conversations.findConversation(db, { ...lookup, conversationId }),
    ).toBeNull();
  });
});

describe('feedback and usage', () => {
  it('rates only the owner’s answers and queues a wrong one once', async () => {
    const lookup = { tenantId: tenantA, userId: userA, messageId: answerId };
    expect(await feedback.findOwnAnswer(db, lookup)).toEqual({
      id: answerId,
      question: 'Pump pressure?',
    });
    expect(
      await feedback.findOwnAnswer(db, { ...lookup, userId: tenantA }),
    ).toBeNull();
    await feedback.insertFeedback(db, {
      tenantId: tenantA,
      messageId: answerId,
      rating: 'wrong',
      comment: 'Wrong pressure',
    });
    expect(await feedback.findOpenReviewItem(db, answerId)).toBeNull();
    const itemId = await insertReviewItem(db, {
      tenantId: tenantA,
      messageId: answerId,
      reasonCode: 'marked_wrong',
      reason: 'Wrong pressure',
    });
    expect(await feedback.findOpenReviewItem(db, answerId)).toBe(itemId);
  });

  it('counts this month’s questions for the person and the organisation', async () => {
    const since = new Date(Date.now() - 60_000);
    expect(await countAiQueries(db, { tenantId: tenantA, since })).toBe(1);
    expect(
      await countAiQueries(db, { tenantId: tenantA, since, userId: userA }),
    ).toBe(1);
    expect(
      await countAiQueries(db, { tenantId: tenantA, since, userId: tenantA }),
    ).toBe(0);
  });
});
