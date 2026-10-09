import {
  SNIPPET_MAX_LENGTH,
  toKnowledgeResult,
  toSnippet,
  toTotal,
} from './knowledgeLibraryMapper';
import { KnowledgeResultRow } from './types/knowledgeLibraryRows';

const row = (
  overrides: Partial<KnowledgeResultRow> = {},
): KnowledgeResultRow => ({
  id: 'item-1',
  title: 'Rear suspension cylinder recharge',
  type: 'procedure',
  tenant_id: null,
  source_oem: 'Caterpillar',
  updated_at: new Date('2026-03-14T00:00:00Z'),
  version_number: 4,
  live_version_id: 'version-4',
  chunk_text: 'Nitrogen charging sequence,\n\nride-height check.',
  page_number: 214,
  section_heading: 'Suspension',
  models: ['CAT 793F'],
  score: 0.82,
  total_count: '86',
  ...overrides,
});

describe('toSnippet', () => {
  it('collapses whitespace in a short passage', () => {
    expect(toSnippet('Nitrogen  charging\n\nsequence')).toBe(
      'Nitrogen charging sequence',
    );
  });

  it('cuts a long passage at a word boundary with an ellipsis', () => {
    const snippet = toSnippet('word '.repeat(200))!;
    expect(snippet.length).toBeLessThanOrEqual(SNIPPET_MAX_LENGTH + 1);
    expect(snippet.endsWith('word…')).toBe(true);
  });

  it('is null without a passage', () => {
    expect(toSnippet(null)).toBeNull();
  });
});

describe('toKnowledgeResult', () => {
  it('marks tenant-less items as the shared library', () => {
    const result = toKnowledgeResult(row());
    expect(result.source).toBe('shared');
    expect(result.snippet).toBe(
      'Nitrogen charging sequence, ride-height check.',
    );
    expect(result.models).toEqual(['CAT 793F']);
    expect(result.versionNumber).toBe(4);
  });

  it("marks the organisation's own uploads and handles no models", () => {
    const result = toKnowledgeResult(row({ tenant_id: 't-1', models: null }));
    expect(result.source).toBe('organisation');
    expect(result.models).toEqual([]);
  });
});

describe('toKnowledgeResult page and section', () => {
  it('shows no page when browsing, since nothing matched', () => {
    expect(toKnowledgeResult(row())).toMatchObject({
      page: null,
      heading: null,
      sectionId: null,
    });
  });

  it("shows the matched section's page, heading and anchor", () => {
    expect(
      toKnowledgeResult(row(), {
        document_version_id: 'version-4',
        ordinal: 3,
        heading: '4. Diagnostic Procedure',
        page_number: 2,
      }),
    ).toMatchObject({
      page: 2,
      heading: '4. Diagnostic Procedure',
      sectionId: 's3',
    });
  });

  it("falls back to the matched chunk's page with no saved sections", () => {
    expect(toKnowledgeResult(row(), null)).toMatchObject({
      page: 214,
      heading: 'Suspension',
      sectionId: null,
    });
  });

  it('cleans a file-name title', () => {
    expect(
      toKnowledgeResult(row({ title: 'CAT_793F_Bulletin (2).pdf' })).title,
    ).toBe('CAT 793F Bulletin');
  });
});

describe('toTotal', () => {
  it('reads the window count, or zero with no rows', () => {
    expect(toTotal([row()])).toBe(86);
    expect(toTotal([])).toBe(0);
  });
});
