import { NotFoundException } from '@nestjs/common';
import { Client, PoolClient } from 'pg';
import { buildPoolConfig } from '../src/database/buildPoolConfig';
import { readDatabaseUrl } from './dbTestConnection';
import { asTenantRole } from './isolationFixtures';
import { CatalogFixture, seedCatalog } from './knowledgeCatalogFixtures';
import { KnowledgeAccess } from '../src/knowledgeCatalog/access/knowledgeAccess';
import { listCatalogDocuments } from '../src/knowledgeCatalog/documents/catalogDocuments.repository';
import { loadVisibleDocument } from '../src/knowledgeCatalog/documents/catalogDocumentAccess';
import { searchCatalogPages } from '../src/knowledgeCatalog/search/catalogSearch.repository';
import * as facets from '../src/knowledgeCatalog/facets/catalogFacets.repository';
import * as myKnowledge from '../src/knowledgeCatalog/myKnowledge/myKnowledge.repository';
import { listAttentionDocuments } from '../src/knowledgeCatalog/admin/knowledgeAttention.repository';
import { ListCatalogDocumentsQueryDto } from '../src/knowledgeCatalog/dto/listCatalogDocumentsQueryDto';
import { SearchCatalogQueryDto } from '../src/knowledgeCatalog/dto/searchCatalogQueryDto';
import { ForMyMachinesQueryDto } from '../src/knowledgeCatalog/dto/forMyMachinesQueryDto';

// The catalogue SQL against a real database (npm run test:db), run as the
// tenant role with app.user_id set, so RLS and knowledge_can_read_document
// apply. Fixtures are written as the migration owner; everything is rolled
// back.

const client = new Client(buildPoolConfig(readDatabaseUrl()));
// The repositories take a pool client; a plain Client has the same query().
const db = client as unknown as PoolClient;

let seed: CatalogFixture;

const access = (overrides: Partial<KnowledgeAccess> = {}): KnowledgeAccess => ({
  tenantId: seed.tenantA,
  userId: seed.userA,
  isAdmin: false,
  isPlatform: false,
  ...overrides,
});

const listQuery = (
  overrides: Partial<ListCatalogDocumentsQueryDto> = {},
): ListCatalogDocumentsQueryDto =>
  Object.assign(new ListCatalogDocumentsQueryDto(), overrides);

const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort();

beforeAll(() => client.connect());
afterAll(() => client.end());

beforeEach(async () => {
  await client.query('BEGIN');
  seed = await seedCatalog(client);
  await asTenantRole(client, seed.tenantA);
  await client.query("SELECT set_config('app.user_id', $1, true)", [
    seed.userA,
  ]);
});

afterEach(() => client.query('ROLLBACK'));

describe('document list', () => {
  it('gives technicians live documents of their organisation and the shared library', async () => {
    const rows = await listCatalogDocuments(db, access(), listQuery());
    expect(ids(rows)).toEqual(
      [seed.docs.sharedCat, seed.docs.ownKomatsu].sort(),
    );
    expect(rows.find((row) => row.id === seed.docs.sharedCat)).toMatchObject({
      brand_id: seed.cat.brandId,
      category_id: seed.cat.categoryId,
      category_name: 'Engine',
    });
  });

  it('gives admins every state, filterable by status', async () => {
    const admin = access({ isAdmin: true });
    const all = await listCatalogDocuments(db, admin, listQuery());
    expect(ids(all)).toContain(seed.docs.ownReview);
    const inReview = await listCatalogDocuments(
      db,
      admin,
      listQuery({ status: 'needs_review' }),
    );
    expect(ids(inReview)).toEqual([seed.docs.ownReview]);
  });

  it('hides documents of inactive brands, even from Knowledge admins', async () => {
    const rows = await listCatalogDocuments(
      db,
      access({ isAdmin: true }),
      listQuery(),
    );
    expect(ids(rows)).not.toContain(seed.docs.retired);
  });
});

describe('opening a document', () => {
  it('is 404 for what the caller cannot read', async () => {
    for (const hidden of [
      seed.docs.otherTenant,
      seed.docs.ownReview,
      seed.docs.retired,
    ]) {
      await expect(
        loadVisibleDocument(db, access(), hidden),
      ).rejects.toBeInstanceOf(NotFoundException);
    }
    await expect(
      loadVisibleDocument(db, access({ isAdmin: true }), seed.docs.ownReview),
    ).resolves.toMatchObject({
      id: seed.docs.ownReview,
      state: 'needs_review',
    });
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
      id: seed.docs.sharedCat,
      hit_page: 1,
      section_ordinal: 0,
    });
    expect(hit.snippet).toContain('<mark>relief</mark>');
  });

  it('counts readable documents per brand and model', async () => {
    const brands = await facets.listBrandFacets(db, access());
    expect(brands.map((row) => [row.id, Number(row.document_count)])).toEqual(
      expect.arrayContaining([
        [seed.cat.brandId, 1],
        [seed.komatsu.brandId, 1],
      ]),
    );
    const models = await facets.listModelFacets(db, access(), {
      brandId: seed.cat.brandId,
    });
    expect(models).toHaveLength(1);
  });

  it("lists a brand's nested categories, empty ones included", async () => {
    await client.query('RESET ROLE');
    await client.query(
      `INSERT INTO knowledge_categories (brand_id, parent_id, name, slug)
       VALUES ($1, $2, 'Hydraulics', 'hydraulics')`,
      [seed.cat.brandId, seed.cat.categoryId],
    );
    await asTenantRole(client, seed.tenantA);
    const rows = await facets.listCategoryFacets(
      db,
      access(),
      seed.cat.brandId,
    );
    expect(
      rows.map((row) => [row.name, row.parent_id, Number(row.document_count)]),
    ).toEqual([
      ['Engine', null, 1],
      ['Hydraulics', seed.cat.categoryId, 0],
    ]);
  });
});

describe('my knowledge', () => {
  it('keeps the last page when a document is reopened without one', async () => {
    const view = {
      tenantId: seed.tenantA,
      userId: seed.userA,
      itemId: seed.docs.sharedCat,
    };
    await myKnowledge.upsertRecentView(db, { ...view, page: 2 });
    await myKnowledge.upsertRecentView(db, { ...view, page: null });
    const recent = await myKnowledge.listRecentDocuments(db, access());
    expect(recent.map((row) => [row.id, row.last_page])).toEqual([
      [seed.docs.sharedCat, 2],
    ]);
  });

  it('matches documents to the fleet by model', async () => {
    const rows = await myKnowledge.listDocumentsForMachines(
      db,
      access(),
      new ForMyMachinesQueryDto(),
    );
    expect(ids(rows)).toEqual([seed.docs.sharedCat]);
    expect(rows[0].matched_machines).toEqual([
      expect.objectContaining({ serialNumber: 'SN-1' }),
    ]);
  });

  it('lists documents waiting for review for admins', async () => {
    const rows = await listAttentionDocuments(db, access({ isAdmin: true }));
    expect(rows.map((row) => [row.id, row.reason])).toEqual([
      [seed.docs.ownReview, 'needs_review'],
    ]);
  });
});
