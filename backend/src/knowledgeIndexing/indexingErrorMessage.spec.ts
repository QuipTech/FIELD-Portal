import { toIndexingErrorMessage } from './indexingErrorMessage';

describe('indexing error message', () => {
  const original = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it('adds the underlying error outside production', () => {
    process.env.NODE_ENV = 'staging';
    expect(toIndexingErrorMessage(new RangeError('Invalid array length'))).toBe(
      'Indexing failed unexpectedly. Retry, or contact support if it keeps happening. [RangeError: Invalid array length]',
    );
  });

  it('keeps production plain', () => {
    process.env.NODE_ENV = 'production';
    expect(toIndexingErrorMessage(new Error('secret detail'))).toBe(
      'Indexing failed unexpectedly. Retry, or contact support if it keeps happening.',
    );
  });
});
