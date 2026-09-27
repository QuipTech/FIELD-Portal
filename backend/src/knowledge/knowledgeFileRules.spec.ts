import { deriveDocumentState } from './knowledgeFileRules';

describe('deriveDocumentState', () => {
  it.each([
    ['draft', 'uploading', 'uploading'],
    ['draft', 'pending', 'queued'],
    ['draft', 'parsing', 'indexing'],
    ['draft', 'embedding', 'indexing'],
    ['draft', 'failed', 'failed'],
    ['review', 'ready', 'needs_review'],
    ['published', 'ready', 'live'],
    // A new version of a live document shows its own progress…
    ['published', 'pending', 'queued'],
    // …and archiving wins over everything.
    ['archived', 'ready', 'archived'],
    ['archived', 'failed', 'archived'],
  ])('status %s + ingestion %s → %s', (status, ingestion, expected) => {
    expect(deriveDocumentState(status, ingestion)).toBe(expected);
  });
});
