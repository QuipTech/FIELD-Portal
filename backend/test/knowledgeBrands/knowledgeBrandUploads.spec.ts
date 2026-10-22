import { randomUUID } from 'crypto';
import { setupKnowledgeFixtures } from './knowledgeFixtures';
import { createDocumentVersion } from '../../src/documents/documentLifecycle.repository';
import { KnowledgeMetadataService } from '../../src/knowledge/knowledgeMetadata.service';
import { KnowledgeBrandsService } from '../../src/knowledgeBrands/knowledgeBrands.service';
import { getAccessibleBrandIds } from '../../src/knowledge/knowledgeAccess';
import { StorageService } from '../../src/storage/storage.service';

const context = setupKnowledgeFixtures();
describe('Knowledge classification and upload invariants', () => {
  it('reserves a numeric version and full key using current category IDs', async () => {
    const { fixture, cat, catDoc } = context();
    const versionId = randomUUID();
    const reserved = await createDocumentVersion(fixture.database, {
      itemId: catDoc.itemId,
      versionId,
      userId: fixture.admin.userId,
      bucket: 'test-bucket',
      fileName: 'Service manual.pdf',
      contentType: 'application/pdf',
      sizeBytes: 50,
    });
    expect(reserved).toEqual({
      versionNumber: 2,
      key: `knowledge/brands/${cat.id}/${cat.categoryId}/${catDoc.documentId}/v2/Service-manual.pdf`,
    });
    const stored = await fixture.db.query<{ storage_key: string }>(
      'SELECT storage_key FROM document_versions WHERE id=$1',
      [versionId],
    );
    expect(stored.rows[0].storage_key).toBe(reserved?.key);
  });
  it('holds client documents for review after indexing', async () => {
    const { fixture, catDoc } = context();
    await fixture.db.query('UPDATE documents SET tenant_id=$1 WHERE id=$2', [
      fixture.actor.tenantId,
      catDoc.documentId,
    ]);
    await fixture.db.query(
      'UPDATE knowledge_items SET tenant_id=$1 WHERE id=$2',
      [fixture.actor.tenantId, catDoc.itemId],
    );
    await fixture.db.query(
      "UPDATE document_versions SET ingestion_status='embedding' WHERE id=$1",
      [catDoc.versionId],
    );
    const completed = await fixture.db.query<{ state: string }>(
      'SELECT complete_indexing($1,1) AS state',
      [catDoc.versionId],
    );
    expect(completed.rows[0].state).toBe('needs_review');
  });
  it('prevents cycles and cross-brand category assignments', async () => {
    const { fixture, cat, komatsu, catDoc } = context();
    const brands = new KnowledgeBrandsService(
      fixture.database,
      {} as StorageService,
    );
    const child = await brands.saveCategory(fixture.admin, cat.id, {
      name: 'Child',
      slug: 'child',
      parentId: cat.categoryId,
    });
    await expect(
      brands.saveCategory(
        fixture.admin,
        cat.id,
        { name: 'Maintenance', slug: 'maintenance', parentId: child.id },
        cat.categoryId,
      ),
    ).rejects.toThrow('cycle');
    await expect(
      new KnowledgeMetadataService(fixture.database).update(
        fixture.admin,
        catDoc.itemId,
        { categoryId: komatsu.categoryId },
      ),
    ).rejects.toThrow('valid category');
  });
  it('preserves manually linked models through automatic re-indexing', async () => {
    const { fixture, catDoc } = context();
    const manufacturerId = randomUUID();
    const modelId = randomUUID();
    await fixture.db.query(
      "INSERT INTO machine_manufacturers(id,name) VALUES($1,'Manual link test')",
      [manufacturerId],
    );
    await fixture.db.query(
      "INSERT INTO machine_models(id,manufacturer_id,name) VALUES($1,$2,'D10T')",
      [modelId, manufacturerId],
    );
    await new KnowledgeMetadataService(fixture.database).update(
      fixture.admin,
      catDoc.itemId,
      { machineModelIds: [modelId] },
    );
    await fixture.db.query(
      'SELECT link_document_machine_models($1,$2::uuid[],$3::int[])',
      [catDoc.itemId, [], []],
    );
    const links = await fixture.db.query<{ machine_model_id: string }>(
      'SELECT machine_model_id FROM knowledge_item_machine_models WHERE knowledge_item_id=$1',
      [catDoc.itemId],
    );
    expect(links.rows.map((row) => row.machine_model_id)).toEqual([modelId]);
  });
  it('hides inactive brands from clients while keeping administrator access', async () => {
    const { fixture, cat } = context();
    await fixture.db.query(
      'UPDATE knowledge_brands SET is_active=false WHERE id=$1',
      [cat.id],
    );
    expect(
      await getAccessibleBrandIds(fixture.database, fixture.actor),
    ).not.toContain(cat.id);
    expect(
      await getAccessibleBrandIds(fixture.database, fixture.admin),
    ).toContain(cat.id);
  });
  it('backfills brand/category metadata onto existing embeddings', async () => {
    const { fixture } = context();
    const chunks = await fixture.db.query<{
      brand_id: string;
      category_id: string;
    }>(
      'SELECT brand_id,category_id FROM document_chunks WHERE document_id=$1',
      [fixture.legacy.documentId],
    );
    expect(chunks.rows[0].brand_id).toBeTruthy();
    expect(chunks.rows[0].category_id).toBeTruthy();
  });
});
