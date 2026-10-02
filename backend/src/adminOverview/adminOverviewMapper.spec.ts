import {
  toIngestionQueueEntry,
  toSearchablePercent,
} from './adminOverviewMapper';
import { IngestionQueueRow } from './types/adminOverviewRows';

const row = (overrides: Partial<IngestionQueueRow>): IngestionQueueRow => ({
  item_id: 'i1',
  title: 'CAT 793F service manual',
  organisation_name: null,
  item_status: 'draft',
  ingestion_status: 'pending',
  progress: 0,
  page_count: 412,
  error_message: null,
  queue_position: '3',
  uploaded_by_name: 'T. Meyer',
  uploaded_at: new Date('2026-10-01T10:00:00Z'),
  ...overrides,
});

describe('toSearchablePercent', () => {
  it('rounds down and caps at 100', () => {
    expect(toSearchablePercent(996, 1000)).toBe(99);
    expect(toSearchablePercent(12, 10)).toBe(100);
  });

  it('is null with nothing uploaded', () => {
    expect(toSearchablePercent(0, 0)).toBeNull();
  });
});

describe('toIngestionQueueEntry', () => {
  it('maps the Knowledge screen states', () => {
    expect(toIngestionQueueEntry(row({}))?.state).toBe('queued');
    expect(
      toIngestionQueueEntry(
        row({ ingestion_status: 'chunking', progress: 68 }),
      ),
    ).toMatchObject({ state: 'indexing', progress: 68 });
    expect(
      toIngestionQueueEntry(row({ ingestion_status: 'failed' }))?.state,
    ).toBe('failed');
    expect(
      toIngestionQueueEntry(
        row({ ingestion_status: 'ready', item_status: 'review' }),
      )?.state,
    ).toBe('needs_review');
  });

  it('skips documents that need nothing', () => {
    expect(
      toIngestionQueueEntry(
        row({ ingestion_status: 'ready', item_status: 'published' }),
      ),
    ).toBeNull();
  });
});
