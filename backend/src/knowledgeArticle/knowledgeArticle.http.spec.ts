import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { KnowledgeArticleController } from './knowledgeArticle.controller';
import { KnowledgeArticleService } from './knowledgeArticle.service';
import { ArticleDocumentRow } from './types/knowledgeArticleRows';

// The real controller and service; sign-in, storage and the database are
// faked. The fake database applies the same scope as the SQL: a document
// is found only in its own organisation, or by anyone when shared.
const OWN_DOC = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT_DOC = '22222222-2222-4222-8222-222222222222';
const SHARED_DOC = '33333333-3333-4333-8333-333333333333';
const INDEXING_DOC = '44444444-4444-4444-8444-444444444444';

const document = (
  id: string,
  overrides: Partial<ArticleDocumentRow> = {},
): ArticleDocumentRow => ({
  id,
  title: 'CAT_793F_Hydraulic_Bulletin (2).pdf',
  type: 'bulletin',
  status: 'published',
  tenant_id: 'tenant-a',
  live_version_id: `version-${id}`,
  version_number: 2,
  page_count: 2,
  summary: null,
  file_name: 'CAT_793F_Hydraulic_Bulletin (2).pdf',
  storage_key: 'documents/tenant-a/x.pdf',
  latest_ingestion_status: 'ready',
  latest_progress: 100,
  make_name: 'CAT',
  model_name: '793F',
  model_id: 'model-1',
  ...overrides,
});

const DOCUMENTS = [
  document(OWN_DOC),
  document(OTHER_TENANT_DOC, { tenant_id: 'tenant-b' }),
  document(SHARED_DOC, { tenant_id: null }),
  document(INDEXING_DOC, {
    live_version_id: null,
    latest_ingestion_status: 'embedding',
    latest_progress: 62,
  }),
];

const SECTIONS = [
  {
    ordinal: 0,
    heading: '1. Purpose',
    page_number: 1,
    content: 'Covers hoist pressure loss.\n\nSecond paragraph.',
  },
  {
    ordinal: 1,
    heading: '2. Symptoms',
    page_number: 2,
    content: '• Slow raise.',
  },
];

const fakeClient = {
  query: async (sql: string, params: unknown[]) => {
    if (sql.includes('FROM knowledge_items ki') && sql.includes('ki.id = $1')) {
      const [itemId, tenantId] = params;
      return {
        rows: DOCUMENTS.filter(
          (row) =>
            row.id === itemId &&
            (row.tenant_id === null || row.tenant_id === tenantId),
        ),
      };
    }
    if (sql.includes('FROM document_sections')) return { rows: SECTIONS };
    return { rows: [] };
  },
};

const fakeJwtGuard: CanActivate = {
  canActivate: (context: ExecutionContext) => {
    context.switchToHttp().getRequest().user = {
      userId: 'user-a',
      tenantId: 'tenant-a',
      email: 'a@x.y',
    };
    return true;
  },
};

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [KnowledgeArticleController],
    providers: [
      KnowledgeArticleService,
      {
        provide: DatabaseService,
        useValue: {
          withTenant: (_tenantId: string, work: (client: unknown) => unknown) =>
            work(fakeClient),
        },
      },
      {
        provide: StorageService,
        useValue: {
          getSignedDownloadUrl: async () => ({ url: 'https://s3/signed' }),
        },
      },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(fakeJwtGuard)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(() => app.close());

const getArticle = (id: string) =>
  request(app.getHttpServer()).get(`/documents/${id}/article`);

describe('GET /documents/:id/article', () => {
  it("returns the organisation's own document as sections, with a clean title", async () => {
    const { body } = await getArticle(OWN_DOC).expect(200);
    expect(body).toMatchObject({
      title: 'CAT 793F Hydraulic Bulletin',
      source: 'tenant',
      revision: 2,
      machineMake: 'CAT',
      machineModel: '793F',
      summary: 'Covers hoist pressure loss.',
      pdfUrl: 'https://s3/signed',
    });
    expect(
      body.sections.map((section: { id: string; heading: string }) => [
        section.id,
        section.heading,
      ]),
    ).toEqual([
      ['s0', '1. Purpose'],
      ['s1', '2. Symptoms'],
    ]);
  });

  it('returns the shared QuipTech library to everyone', async () => {
    const { body } = await getArticle(SHARED_DOC).expect(200);
    expect(body.source).toBe('quiptech_library');
  });

  it("answers 404 for another organisation's document", async () => {
    const { body } = await getArticle(OTHER_TENANT_DOC).expect(404);
    expect(body.message).toBe('Document not found.');
  });

  it('answers 409 with the state while the document is still indexing', async () => {
    const { body } = await getArticle(INDEXING_DOC).expect(409);
    expect(body).toMatchObject({ state: 'indexing', progress: 62 });
  });
});
