import { randomUUID } from 'crypto';

import {
  listMessages,
  listMessageSources,
} from '../../src/aiAssistant/aiConversations.repository';
import { KnowledgeMetadataService } from '../../src/knowledge/knowledgeMetadata.service';
import { OrganisationBrandAccessService } from '../../src/knowledgeBrands/organisationBrandAccess.service';

import { setupKnowledgeFixtures } from './knowledgeFixtures';
const context = setupKnowledgeFixtures();
describe('Knowledge metadata and saved answers', () => {
  it('moves metadata and chunks without changing the file key', async () => {
    const { fixture, cat, catDoc, articles } = context();
    const category = randomUUID();
    await fixture.db.query(
      "INSERT INTO knowledge_categories(id,brand_id,name,slug) VALUES($1,$2,'New folder','new-folder')",
      [category, cat.id],
    );
    await new KnowledgeMetadataService(fixture.database).update(
      fixture.admin,
      catDoc.itemId,
      { brandId: cat.id, categoryId: category, documentType: 'guide' },
    );
    const chunks = await fixture.db.query<{ category_id: string }>(
      'SELECT category_id FROM document_chunks WHERE document_id=$1',
      [catDoc.documentId],
    );
    expect(chunks.rows[0].category_id).toBe(category);
    const version = await fixture.db.query<{ storage_key: string }>(
      'SELECT storage_key FROM document_versions WHERE id=$1',
      [catDoc.versionId],
    );
    expect(version.rows[0].storage_key).toBe(catDoc.key);
    expect(
      (await articles().getArticle(fixture.actor, catDoc.itemId)).type,
    ).toBe('guide');
  });
  it('keeps legacy documents readable after backfill without changing S3 keys', async () => {
    const { fixture, articles } = context();
    const article = await articles().getArticle(
      fixture.actor,
      fixture.legacy.itemId,
    );
    expect(article.title).toBe('Legacy manual');
    const row = await fixture.db.query<{ storage_key: string }>(
      'SELECT storage_key FROM document_versions WHERE id=$1',
      [fixture.legacy.versionId],
    );
    expect(row.rows[0].storage_key).toBe(
      'documents/shared/legacy/v1/legacy.pdf',
    );
  });
  it('withholds previous answer text and citations after revocation', async () => {
    const { fixture, catDoc, asClient } = context();
    const conversationId = randomUUID();
    const messageId = randomUUID();
    await fixture.db.query(
      'INSERT INTO ai_conversations(id,tenant_id,user_id,title) VALUES($1,$2,$3,$4)',
      [conversationId, fixture.actor.tenantId, fixture.actor.userId, 'Test'],
    );
    await fixture.db.query(
      "INSERT INTO ai_messages(id,tenant_id,conversation_id,role,content) VALUES($1,$2,$3,'assistant','Caterpillar secret')",
      [messageId, fixture.actor.tenantId, conversationId],
    );
    await fixture.db.query(
      'INSERT INTO ai_message_documents(message_id,document_id) VALUES($1,$2)',
      [messageId, catDoc.documentId],
    );
    await fixture.db.query(
      'INSERT INTO ai_source_references(tenant_id,message_id,chunk_id) SELECT $1,$2,id FROM document_chunks WHERE document_id=$3',
      [fixture.actor.tenantId, messageId, catDoc.documentId],
    );
    await new OrganisationBrandAccessService(fixture.database).set(
      fixture.admin,
      fixture.actor.tenantId,
      [],
    );
    const messages = await asClient((client) =>
      listMessages(client, {
        tenantId: fixture.actor.tenantId,
        conversationId,
      }),
    );
    expect(messages[0].content).not.toContain('Caterpillar secret');
    expect(
      await listMessageSources(fixture.database, {
        tenantId: fixture.actor.tenantId,
        userId: fixture.actor.userId,
        conversationId,
      }),
    ).toEqual([]);
  });
});
