import { DocumentsService } from '../../src/documents/documents.service';
import { SharedLibraryStorageService } from '../../src/storage/sharedLibraryStorage.service';
import { KnowledgeMetadataService } from '../../src/knowledge/knowledgeMetadata.service';
import { StorageService } from '../../src/storage/storage.service';
import { DocumentPageCountService } from '../../src/knowledge/documentPageCount.service';
import { IndexingWorkerService } from '../../src/knowledgeIndexing/indexingWorker.service';
import { randomUUID } from 'crypto';
import { NotFoundException } from '@nestjs/common';
import { VECTOR } from './knowledgeTestDatabase';
import { getAccessibleBrandIds } from '../../src/knowledge/knowledgeAccess';
import {
  listKnowledgeDocuments,
  findKnowledgeDocument,
} from '../../src/knowledge/knowledgeDocuments.repository';

import {
  browseKnowledge,
  keywordSearchKnowledge,
  semanticSearchKnowledge,
} from '../../src/knowledgeLibrary/knowledgeLibrary.repository';
import { searchLiveChunks } from '../../src/knowledgeSearch/knowledgeSearch.repository';

import { KnowledgeBrandsService } from '../../src/knowledgeBrands/knowledgeBrands.service';

import { setupKnowledgeFixtures } from './knowledgeFixtures';
const context = setupKnowledgeFixtures();
describe('Knowledge brand isolation with field_app RLS', () => {
  it('filters brand lists, document lists and direct IDs', async () => {
    const { fixture, cat, komatsu, catDoc, komatsuDoc, asClient } = context();
    expect(
      await getAccessibleBrandIds(fixture.database, fixture.actor),
    ).toContain(cat.id);
    expect(
      await getAccessibleBrandIds(fixture.database, fixture.actor),
    ).not.toContain(komatsu.id);
    const rows = await listKnowledgeDocuments(fixture.database, {
      visibleToTenantId: fixture.actor.tenantId,
      userId: fixture.actor.userId,
      limit: 100,
      offset: 0,
    });
    expect(rows.map((row) => row.id)).toContain(catDoc.itemId);
    expect(rows.map((row) => row.id)).not.toContain(komatsuDoc.itemId);
    expect(
      await findKnowledgeDocument(
        fixture.database,
        komatsuDoc.itemId,
        fixture.actor.tenantId,
        false,
        fixture.actor.userId,
      ),
    ).toBeNull();
    expect(
      (
        await asClient((client) =>
          client.query('SELECT id FROM document_chunks WHERE document_id=$1', [
            komatsuDoc.documentId,
          ]),
        )
      ).rows,
    ).toHaveLength(0);
  });
  it('returns 404 and never signs a file from an inaccessible brand', async () => {
    const { fixture, catDoc, komatsuDoc, sign, articles } = context();
    await expect(
      articles().getArticle(fixture.actor, komatsuDoc.itemId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(sign).not.toHaveBeenCalled();
    expect(
      (await articles().getArticle(fixture.actor, catDoc.itemId)).pdfUrl,
    ).toBe('https://private.test/signed');
  });
  it('denies the legacy/mobile signed-download endpoint before signing', async () => {
    const { fixture, komatsuDoc, sign } = context();
    const documents = new DocumentsService(
      {} as SharedLibraryStorageService,
      new KnowledgeMetadataService(fixture.database),
      fixture.database,
      { getSignedDownloadUrl: sign } as unknown as StorageService,
      {} as DocumentPageCountService,
      {} as IndexingWorkerService,
    );
    await expect(
      documents.createDownloadUrl(fixture.actor, komatsuDoc.itemId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(sign).not.toHaveBeenCalled();
  });
  it('filters browse, keyword search, semantic search and AI before ranking', async () => {
    const { fixture, catDoc, komatsuDoc, asClient, filters } = context();
    const browse = await asClient((client) =>
      browseKnowledge(client, fixture.actor.tenantId, filters()),
    );
    const keyword = await asClient((client) =>
      keywordSearchKnowledge(client, fixture.actor.tenantId, {
        ...filters(),
        search: 'hydraulic',
      }),
    );
    const semantic = await asClient((client) =>
      semanticSearchKnowledge(client, fixture.actor.tenantId, {
        ...filters(),
        queryVector: VECTOR,
      }),
    );
    const ai = await asClient((client) =>
      searchLiveChunks(client, {
        tenantId: fixture.actor.tenantId,
        userId: fixture.actor.userId,
        queryVector: VECTOR,
        limit: 20,
      }),
    );
    for (const rows of [browse, keyword, semantic]) {
      expect(rows.map((row) => row.id)).toContain(catDoc.itemId);
      expect(rows.map((row) => row.id)).not.toContain(komatsuDoc.itemId);
    }
    expect(ai.map((row) => row.knowledge_item_id)).toContain(catDoc.itemId);
    expect(ai.map((row) => row.knowledge_item_id)).not.toContain(
      komatsuDoc.itemId,
    );
  });
  it('filters the machine Manuals query by access as well as model', async () => {
    const { fixture, catDoc, komatsuDoc, asClient, filters } = context();
    const maker = randomUUID();
    const model = randomUUID();
    await fixture.db.query(
      "INSERT INTO machine_manufacturers(id,name) VALUES($1,'Test maker')",
      [maker],
    );
    await fixture.db.query(
      "INSERT INTO machine_models(id,manufacturer_id,name) VALUES($1,$2,'D10T')",
      [model, maker],
    );
    for (const item of [catDoc, komatsuDoc])
      await fixture.db.query(
        'INSERT INTO knowledge_item_machine_models(knowledge_item_id,machine_model_id) VALUES($1,$2)',
        [item.itemId, model],
      );
    const rows = await asClient((client) =>
      browseKnowledge(client, fixture.actor.tenantId, filters({ model })),
    );
    expect(rows.map((row) => row.id)).toEqual([catDoc.itemId]);
  });
  it('shows every active brand to every organisation without any grant', async () => {
    const { fixture, cat, catDoc, articles } = context();
    const grants = await fixture.db.query(
      'SELECT 1 FROM organisation_brand_access WHERE organisation_id=$1 AND brand_id=$2',
      [fixture.actor.tenantId, cat.id],
    );
    expect(grants.rows).toHaveLength(0);
    expect(
      await getAccessibleBrandIds(fixture.database, fixture.actor),
    ).toContain(cat.id);
    expect(
      (await articles().getArticle(fixture.actor, catDoc.itemId)).title,
    ).toBe('D10T manual');
  });
  it('hides a brand on the next query once it is deactivated', async () => {
    const { fixture, cat, catDoc, articles, asClient } = context();
    await fixture.db.query(
      'UPDATE knowledge_brands SET is_active=false WHERE id=$1',
      [cat.id],
    );
    expect(
      await getAccessibleBrandIds(fixture.database, fixture.actor),
    ).not.toContain(cat.id);
    await expect(
      articles().getArticle(fixture.actor, catDoc.itemId),
    ).rejects.toBeInstanceOf(NotFoundException);
    const ai = await asClient((client) =>
      searchLiveChunks(client, {
        tenantId: fixture.actor.tenantId,
        userId: fixture.actor.userId,
        queryVector: VECTOR,
        limit: 20,
      }),
    );
    expect(ai.map((chunk) => chunk.knowledge_item_id)).not.toContain(
      catDoc.itemId,
    );
  });
  it('lets the platform administrator see all brands and documents', async () => {
    const { fixture, komatsu, komatsuDoc, articles } = context();
    expect(
      await getAccessibleBrandIds(fixture.database, fixture.admin),
    ).toContain(komatsu.id);
    expect(
      (await articles().getArticle(fixture.admin, komatsuDoc.itemId)).title,
    ).toBe('Komatsu manual');
  });
  it('limits brand and category lists to accessible brands', async () => {
    const { fixture, cat, komatsu } = context();
    const brands = new KnowledgeBrandsService(
      fixture.database,
      {} as StorageService,
    );
    const clientBrands = (await brands.listBrands(fixture.actor)).map(
      (brand) => brand.id,
    );
    expect(clientBrands).toContain(cat.id);
    expect(clientBrands).not.toContain(komatsu.id);
    const clientCategories = (await brands.listAllCategories(fixture.actor)).map(
      (category) => category.brandId,
    );
    expect(clientCategories).toContain(cat.id);
    expect(clientCategories).not.toContain(komatsu.id);
    expect(
      (await brands.listCategories(fixture.actor, cat.id)).length,
    ).toBeGreaterThan(0);
    await expect(
      brands.listCategories(fixture.actor, komatsu.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      (await brands.listAllCategories(fixture.admin)).map(
        (category) => category.brandId,
      ),
    ).toContain(komatsu.id);
  });
});
