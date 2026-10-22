import 'reflect-metadata';
import { Client, PoolClient } from 'pg';
import { buildPoolConfig } from '../src/database/buildPoolConfig';
import { readDatabaseUrl } from './dbTestConnection';
import {
  asTenantRole,
  insertKnowledgeBrand,
  insertTenant,
} from './isolationFixtures';
import {
  VECTOR,
  seedAiDocument,
  toDatabaseService,
} from './aiAssistantFixtures';
import { searchLiveChunks } from '../src/knowledgeSearch/knowledgeSearch.repository';
import * as conversations from '../src/aiAssistant/aiConversations.repository';
import * as feedback from '../src/aiAssistant/feedback/aiFeedback.repository';
import { insertReviewItem } from '../src/aiAssistant/aiAnswer.repository';
import { countAiQueries } from '../src/aiAssistant/usage/aiUsage.repository';

// The AI assistant's new SQL against a real database (npm run test:db), as
// the tenant role so RLS applies. Fixtures are written as the migration
// owner; everything is rolled back.

const client = new Client(buildPoolConfig(readDatabaseUrl()));
const db = client as unknown as PoolClient;
const databaseService = toDatabaseService(client);

let tenantA: string;
let userA: string;
let cat: string;
let komatsu: string;
let retired: string;
let catDoc: string;
let komatsuDoc: string;
let catChunk: string;
let conversationId: string;
let answerId: string;

const insertReturningId = async (sql: string, params: unknown[]) =>
  (await client.query<{ id: string }>(sql, params)).rows[0].id;

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
  const catBrand = await insertKnowledgeBrand(client, 'CAT');
  const komatsuBrand = await insertKnowledgeBrand(client, 'Komatsu');
  const retiredBrand = await insertKnowledgeBrand(client, 'Retired', false);
  cat = catBrand.brandId;
  komatsu = komatsuBrand.brandId;
  retired = retiredBrand.brandId;
  const catSeed = await seedAiDocument(client, 'CAT manual', catBrand);
  catDoc = catSeed.itemId;
  catChunk = catSeed.chunkId;
  komatsuDoc = (await seedAiDocument(client, 'Komatsu manual', komatsuBrand))
    .itemId;
  await seedAiDocument(client, 'Retired manual', retiredBrand);
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

const search = (scope: { brandId?: string } = {}) =>
  searchLiveChunks(databaseService, {
    queryVector: VECTOR,
    tenantId: tenantA,
    userId: userA,
    limit: 10,
    ...scope,
  });

describe('retrieval', () => {
  it('resolves each chunk to the section on its page', async () => {
    // The dev database also holds real library documents.
    const rows = (await search()).filter((row) =>
      [catDoc, komatsuDoc].includes(row.knowledge_item_id),
    );
    expect(rows.map((row) => row.knowledge_item_id).sort()).toEqual(
      [catDoc, komatsuDoc].sort(),
    );
    expect(rows[0]).toMatchObject({
      section_ordinal: 1,
      section_title: '4.3 Hydraulic pump',
    });
  });

  it('skips inactive brands and keeps to a chosen brand', async () => {
    expect(await search({ brandId: retired })).toEqual([]);
    const scoped = await search({ brandId: komatsu });
    expect(scoped.map((row) => row.knowledge_item_id)).toEqual([komatsuDoc]);
    const catOnly = await search({ brandId: cat });
    expect(catOnly.map((row) => row.knowledge_item_id)).toEqual([catDoc]);
  });
});

describe('conversations', () => {
  it('gives saved sources their section', async () => {
    const sources = await conversations.listMessageSources(databaseService, {
      tenantId: tenantA,
      conversationId,
      userId: userA,
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
