import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Client, PoolClient } from 'pg';
import { buildPoolConfig } from '../src/database/buildPoolConfig';
import { readDatabaseUrl } from './dbTestConnection';
import { asTenantRole, insertTenant } from './isolationFixtures';
import { KnowledgeAccess } from '../src/knowledgeCatalog/access/knowledgeAccess';
import { listCatalogDocuments } from '../src/knowledgeCatalog/documents/catalogDocuments.repository';
import { loadVisibleDocument } from '../src/knowledgeCatalog/documents/catalogDocumentAccess';
import { searchCatalogPages } from '../src/knowledgeCatalog/search/catalogSearch.repository';
import * as facets from '../src/knowledgeCatalog/facets/catalogFacets.repository';
import { listBrandSummaries } from '../src/knowledgeCatalog/brands/knowledgeBrands.repository';
import * as myKnowledge from '../src/knowledgeCatalog/myKnowledge/myKnowledge.repository';
import { listAttentionDocuments } from '../src/knowledgeCatalog/admin/knowledgeAttention.repository';
import { ListCatalogDocumentsQueryDto } from '../src/knowledgeCatalog/dto/listCatalogDocumentsQueryDto';
import { SearchCatalogQueryDto } from '../src/knowledgeCatalog/dto/searchCatalogQueryDto';
import { ForMyMachinesQueryDto } from '../src/knowledgeCatalog/dto/forMyMachinesQueryDto';
import * as taxonomy from '../src/knowledgeCatalog/admin/knowledgeTaxonomy.repository';

// The catalogue SQL against a real database (npm run test:db), run as the
// tenant role so RLS applies. Fixtures are written as the migration owner;
// everything is rolled back.

const client = new Client(buildPoolConfig(readDatabaseUrl()));
// The repositories take a pool client; a plain Client has the same query().
const db = client as unknown as PoolClient;

let tenantA: string;
let userA: string;
let cat: string;
let komatsu: string;
let docs: Record<
  'sharedCat' | 'ownKomatsu' | 'ownReview' | 'otherTenant' | 'brandless',
  string
>;

const access = (overrides: Partial<KnowledgeAccess> = {}): KnowledgeAccess => ({
  tenantId: tenantA,
  userId: userA,
  isAdmin: false,
  isPlatform: false,
  brandIds: null,
  ...overrides,
});

const listQuery = (
  overrides: Partial<ListCatalogDocumentsQueryDto> = {},
): ListCatalogDocumentsQueryDto =>
  Object.assign(new ListCatalogDocumentsQueryDto(), overrides);

const insertReturningId = async (sql: string, params: unknown[]) =>
  (await client.query<{ id: string }>(sql, params)).rows[0].id;

const seedDocument = async (doc: {
  tenantId: string | null;
  title: string;
  status: string;
  isLive: boolean;
  brandId?: string;
  modelId?: string;
}): Promise<{ itemId: string; versionId: string }> => {
  const itemId = await insertReturningId(
    `INSERT INTO knowledge_items (tenant_id, title, type, status, source_type, manufacturer_id)
     VALUES ($1, $2, 'manual', $3, 'internal', $4) RETURNING id`,
    [doc.tenantId, doc.title, doc.status, doc.brandId ?? null],
  );
  const documentId = await insertReturningId(
    'INSERT INTO documents (tenant_id, knowledge_item_id) VALUES ($1, $2) RETURNING id',
    [doc.tenantId, itemId],
  );
  const versionId = await insertReturningId(
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

const seedCatalog = async () => {
  tenantA = await insertTenant(client, 'catalog-a');
  const tenantB = await insertTenant(client, 'catalog-b');
  userA = await insertReturningId(
    `INSERT INTO users (tenant_id, email, first_name, last_name, cognito_sub)
     VALUES ($1, $2, 'Tess', 'Tech', $2) RETURNING id`,
    [tenantA, `tech-${Date.now()}@example.com`],
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
  const cat793 = await insertReturningId(
    `INSERT INTO machine_models (manufacturer_id, name) VALUES ($1, '793F') RETURNING id`,
    [cat],
  );
  await client.query(
    `INSERT INTO machines (tenant_id, manufacturer_id, model_id, serial_number, site)
     VALUES ($1, $2, $3, 'SN-1', 'Pit 1')`,
    [tenantA, cat, cat793],
  );

  const sharedCat = await seedDocument({
    tenantId: null,
    title: 'CAT 793F Service Manual',
    status: 'published',
    isLive: true,
    modelId: cat793,
  });
  await client.query(
    `INSERT INTO document_pages (document_version_id, page_number, tenant_id, content)
     VALUES ($1, 1, NULL, 'Inspect the hydraulic pump and the main relief valve.'),
            ($1, 2, NULL, 'Torque the wheel nuts.')`,
    [sharedCat.versionId],
  );
  await client.query(
    `INSERT INTO document_sections (document_version_id, ordinal, tenant_id, heading, page_number, content)
     VALUES ($1, 0, NULL, '4.3 Hydraulic pump', 1, 'Inspect the hydraulic pump and the main relief valve.')`,
    [sharedCat.versionId],
  );
  docs = {
    sharedCat: sharedCat.itemId,
    ownKomatsu: (
      await seedDocument({
        tenantId: tenantA,
        title: 'Komatsu bulletin',
        status: 'published',
        isLive: true,
        brandId: komatsu,
      })
    ).itemId,
    ownReview: (
      await seedDocument({
        tenantId: tenantA,
        title: 'CAT draft',
        status: 'review',
        isLive: false,
        brandId: cat,
      })
    ).itemId,
    otherTenant: (
      await seedDocument({
        tenantId: tenantB,
        title: 'Other org',
        status: 'published',
        isLive: true,
        brandId: cat,
      })
    ).itemId,
    brandless: (
      await seedDocument({
        tenantId: tenantA,
        title: 'Site policy',
        status: 'published',
        isLive: true,
      })
    ).itemId,
  };
};

const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort();

beforeAll(() => client.connect());
afterAll(() => client.end());

beforeEach(async () => {
  await client.query('BEGIN');
  await seedCatalog();
  await asTenantRole(client, tenantA);
});

afterEach(() => client.query('ROLLBACK'));

describe('document list', () => {
  it('gives technicians live documents of their organisation and the shared library', async () => {
    const rows = await listCatalogDocuments(db, access(), listQuery());
    expect(ids(rows)).toEqual(
      [docs.sharedCat, docs.ownKomatsu, docs.brandless].sort(),
    );
    expect(rows.find((row) => row.id === docs.sharedCat)?.brand_id).toBe(cat);
  });

  it('gives admins every state, filterable by status', async () => {
    const all = await listCatalogDocuments(
      db,
      access({ isAdmin: true }),
      listQuery(),
    );
    expect(ids(all)).toContain(docs.ownReview);
    const inReview = await listCatalogDocuments(
      db,
      access({ isAdmin: true }),
      listQuery({ status: 'needs_review' }),
    );
    expect(ids(inReview)).toEqual([docs.ownReview]);
  });

  it('hides brands outside a restricted plan but keeps brandless documents', async () => {
    const rows = await listCatalogDocuments(
      db,
      access({ brandIds: [komatsu] }),
      listQuery(),
    );
    expect(ids(rows)).toEqual([docs.ownKomatsu, docs.brandless].sort());
  });
});

describe('opening a document', () => {
  it('is 403 for a brand outside the plan and 404 for what the caller cannot see', async () => {
    await expect(
      loadVisibleDocument(db, access({ brandIds: [komatsu] }), docs.sharedCat),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      loadVisibleDocument(db, access(), docs.otherTenant),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      loadVisibleDocument(db, access(), docs.ownReview),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      loadVisibleDocument(db, access({ isAdmin: true }), docs.ownReview),
    ).resolves.toMatchObject({ id: docs.ownReview, state: 'needs_review' });
  });
});

describe('search and facets', () => {
  it('finds the page and section, with the matched words marked', async () => {
    const query = Object.assign(new SearchCatalogQueryDto(), {
      q: 'relief valve',
    });
    const [hit, ...rest] = await searchCatalogPages(db, access(), query);
    expect(rest).toEqual([]);
    expect(hit).toMatchObject({
      id: docs.sharedCat,
      hit_page: 1,
      section_ordinal: 0,
    });
    expect(hit.snippet).toContain('<mark>relief</mark>');
  });

  it('counts readable documents per brand and model', async () => {
    const brands = await facets.listBrandFacets(db, access());
    expect(brands.map((row) => [row.id, Number(row.document_count)])).toEqual(
      expect.arrayContaining([
        [cat, 1],
        [komatsu, 1],
      ]),
    );
    const models = await facets.listModelFacets(db, access(), { brandId: cat });
    expect(models).toHaveLength(1);
  });

  it('gives admins machine, site and in-review counts per brand', async () => {
    const rows = await listBrandSummaries(db, access({ isAdmin: true }));
    expect(rows.find((row) => row.id === cat)).toMatchObject({
      document_count: '1',
      machine_count: '1',
      site_count: '1',
      in_review_count: '1',
    });
  });
});

describe('my knowledge', () => {
  it('keeps the last page when a document is reopened without one', async () => {
    const view = { tenantId: tenantA, userId: userA, itemId: docs.sharedCat };
    await myKnowledge.upsertRecentView(db, { ...view, page: 2 });
    await myKnowledge.upsertRecentView(db, { ...view, page: null });
    const recent = await myKnowledge.listRecentDocuments(db, access());
    expect(recent.map((row) => [row.id, row.last_page])).toEqual([
      [docs.sharedCat, 2],
    ]);
  });

  it('matches documents to the fleet by model', async () => {
    const query = new ForMyMachinesQueryDto();
    const rows = await myKnowledge.listDocumentsForMachines(
      db,
      access(),
      query,
    );
    expect(ids(rows)).toEqual([docs.sharedCat]);
    expect(rows[0].matched_machines).toEqual([
      expect.objectContaining({ serialNumber: 'SN-1' }),
    ]);
  });

  it('lists documents waiting for review for admins', async () => {
    const rows = await listAttentionDocuments(db, access({ isAdmin: true }));
    expect(rows.map((row) => [row.id, row.reason])).toEqual([
      [docs.ownReview, 'needs_review'],
    ]);
  });
});

describe('taxonomy', () => {
  it("restricts an organisation's plan through set_tenant_brand_access", async () => {
    await taxonomy.setTenantBrandAccess(db, {
      tenantId: tenantA,
      restricted: true,
      brandIds: [komatsu],
      userId: userA,
    });
    const plan = await client.query<{ restricted: boolean; brands: string[] }>(
      `SELECT t.knowledge_brands_restricted AS restricted,
              array(SELECT manufacturer_id FROM tenant_brand_access WHERE tenant_id = t.id) AS brands
       FROM tenants t WHERE t.id = $1`,
      [tenantA],
    );
    expect(plan.rows[0]).toEqual({ restricted: true, brands: [komatsu] });
  });

  it('classifies a shared document and counts it under its category', async () => {
    const category = await taxonomy.insertCategory(db, {
      brandId: cat,
      name: 'Hydraulics',
      sortOrder: 0,
    });
    await taxonomy.setItemClassification(db, {
      itemId: docs.sharedCat,
      brandId: cat,
      categoryId: category.id,
    });
    const categories = await facets.listCategoryFacets(db, access(), cat);
    expect(
      categories.map((row) => [row.name, Number(row.document_count)]),
    ).toEqual([['Hydraulics', 1]]);
  });
});
