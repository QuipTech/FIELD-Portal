import { createKnowledgeTestDatabase } from './knowledgeTestDatabase';
import { KnowledgeArticleService } from '../../src/knowledgeArticle/knowledgeArticle.service';
import { StorageService } from '../../src/storage/storage.service';
import { SearchKnowledgeLibraryQueryDto } from '../../src/knowledgeLibrary/dto/searchKnowledgeLibraryQueryDto';
export const setupKnowledgeFixtures = () => {
  let fixture: Awaited<ReturnType<typeof createKnowledgeTestDatabase>>;
  let cat: { id: string; categoryId: string };
  let komatsu: typeof cat;
  let catDoc: Awaited<ReturnType<typeof fixture.document>>;
  let komatsuDoc: typeof catDoc;
  const sign = jest.fn(async () => ({ url: 'https://private.test/signed' }));
  const articles = () =>
    new KnowledgeArticleService(fixture.database, {
      getSignedDownloadUrl: sign,
    } as unknown as StorageService);
  const asClient = <T>(
    work: Parameters<typeof fixture.database.withActor<T>>[1],
  ) => fixture.database.withActor(fixture.actor, work);
  const filters = (extra = {}) =>
    ({
      page: 1,
      pageSize: 50,
      sort: 'newest',
      ...extra,
    }) as SearchKnowledgeLibraryQueryDto;

  beforeAll(async () => {
    fixture = await createKnowledgeTestDatabase();
  }, 30000);
  afterAll(async () => fixture?.db.close());
  beforeEach(async () => {
    await fixture.db.exec('BEGIN');
    cat = await fixture.brand('Caterpillar');
    komatsu = await fixture.brand('Komatsu');
    catDoc = await fixture.document('D10T manual', cat.id, cat.categoryId);
    komatsuDoc = await fixture.document(
      'Komatsu manual',
      komatsu.id,
      komatsu.categoryId,
    );
    // Every organisation sees active brands; Komatsu is the hidden one.
    await fixture.db.query(
      'UPDATE knowledge_brands SET is_active=false WHERE id=$1',
      [komatsu.id],
    );
    sign.mockClear();
  });
  afterEach(async () => {
    await fixture?.db.exec('ROLLBACK');
  });

  return () => ({
    fixture,
    cat,
    komatsu,
    catDoc,
    komatsuDoc,
    sign,
    articles,
    asClient,
    filters,
  });
};
