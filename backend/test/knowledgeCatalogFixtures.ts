import { Client } from 'pg';
import {
  KnowledgeBrandFixture,
  insertKnowledgeBrand,
  insertTenant,
} from './isolationFixtures';

// The catalogue's test data, written as the migration owner:
//   sharedCat    shared library, CAT, live, linked to the fleet's 793F
//   ownKomatsu   tenant A, Komatsu, live
//   ownReview    tenant A, CAT, waiting for review
//   otherTenant  tenant B, CAT, live
//   retired      tenant A, an inactive brand, live

export interface CatalogFixture {
  tenantA: string;
  userA: string;
  cat: KnowledgeBrandFixture;
  komatsu: KnowledgeBrandFixture;
  docs: Record<
    'sharedCat' | 'ownKomatsu' | 'ownReview' | 'otherTenant' | 'retired',
    string
  >;
  sharedCatVersion: string;
}

const insertReturningId = async (
  client: Client,
  sql: string,
  params: unknown[],
) => (await client.query<{ id: string }>(sql, params)).rows[0].id;

const seedDocument = async (
  client: Client,
  doc: {
    tenantId: string | null;
    title: string;
    status: string;
    isLive: boolean;
    brand: KnowledgeBrandFixture;
    modelId?: string;
  },
): Promise<{ itemId: string; versionId: string }> => {
  const itemId = await insertReturningId(
    client,
    `INSERT INTO knowledge_items (tenant_id, title, type, status, source_type)
     VALUES ($1, $2, 'manual', $3, 'internal') RETURNING id`,
    [doc.tenantId, doc.title, doc.status],
  );
  const documentId = await insertReturningId(
    client,
    `INSERT INTO documents (tenant_id, knowledge_item_id, brand_id, category_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [doc.tenantId, itemId, doc.brand.brandId, doc.brand.categoryId],
  );
  const versionId = await insertReturningId(
    client,
    `INSERT INTO document_versions (tenant_id, document_id, file_url, version_number, ingestion_status, page_count, storage_key)
     VALUES ($1, $2, 'x', 1, 'ready', 3, 'documents/x.pdf') RETURNING id`,
    [doc.tenantId, documentId],
  );
  if (doc.isLive) {
    await client.query(
      'UPDATE documents SET live_version_id = $2 WHERE id = $1',
      [documentId, versionId],
    );
  }
  if (doc.modelId) {
    await client.query(
      'INSERT INTO knowledge_item_machine_models (knowledge_item_id, machine_model_id) VALUES ($1, $2)',
      [itemId, doc.modelId],
    );
  }
  return { itemId, versionId };
};

// Tenant A's fleet: one CAT 793F at Pit 1.
const seedFleet = async (client: Client, tenantId: string) => {
  const maker = await insertReturningId(
    client,
    'INSERT INTO machine_manufacturers (name) VALUES ($1) RETURNING id',
    [`CAT ${Date.now()}`],
  );
  const model = await insertReturningId(
    client,
    `INSERT INTO machine_models (manufacturer_id, name) VALUES ($1, '793F') RETURNING id`,
    [maker],
  );
  await client.query(
    `INSERT INTO machines (tenant_id, manufacturer_id, model_id, serial_number, site)
     VALUES ($1, $2, $3, 'SN-1', 'Pit 1')`,
    [tenantId, maker, model],
  );
  return model;
};

const seedSharedCatPages = async (client: Client, versionId: string) => {
  await client.query(
    `INSERT INTO document_pages (document_version_id, page_number, tenant_id, content)
     VALUES ($1, 1, NULL, 'Inspect the hydraulic pump and the main relief valve.'),
            ($1, 2, NULL, 'Torque the wheel nuts.')`,
    [versionId],
  );
  await client.query(
    `INSERT INTO document_sections (document_version_id, ordinal, tenant_id, heading, page_number, content)
     VALUES ($1, 0, NULL, '4.3 Hydraulic pump', 1, 'Inspect the hydraulic pump and the main relief valve.')`,
    [versionId],
  );
};

export const seedCatalog = async (client: Client): Promise<CatalogFixture> => {
  const tenantA = await insertTenant(client, 'catalog-a');
  const tenantB = await insertTenant(client, 'catalog-b');
  const userA = await insertReturningId(
    client,
    `INSERT INTO users (tenant_id, email, first_name, last_name, cognito_sub)
     VALUES ($1, $2, 'Tess', 'Tech', $2) RETURNING id`,
    [tenantA, `tech-${Date.now()}@example.com`],
  );
  const cat = await insertKnowledgeBrand(client, 'CAT');
  const komatsu = await insertKnowledgeBrand(client, 'Komatsu');
  const retiredBrand = await insertKnowledgeBrand(client, 'Retired', false);
  const modelId = await seedFleet(client, tenantA);
  const live = { status: 'published', isLive: true };

  const sharedCat = await seedDocument(client, {
    ...live,
    tenantId: null,
    title: 'CAT 793F Service Manual',
    brand: cat,
    modelId,
  });
  await seedSharedCatPages(client, sharedCat.versionId);
  const seedOwn = async (
    tenantId: string,
    title: string,
    brand: KnowledgeBrandFixture,
    state = live,
  ) =>
    (await seedDocument(client, { ...state, tenantId, title, brand })).itemId;
  return {
    tenantA,
    userA,
    cat,
    komatsu,
    sharedCatVersion: sharedCat.versionId,
    docs: {
      sharedCat: sharedCat.itemId,
      ownKomatsu: await seedOwn(tenantA, 'Komatsu bulletin', komatsu),
      ownReview: await seedOwn(tenantA, 'CAT draft', cat, {
        status: 'review',
        isLive: false,
      }),
      otherTenant: await seedOwn(tenantB, 'Other org', cat),
      retired: await seedOwn(tenantA, 'Retired brand manual', retiredBrand),
    },
  };
};
