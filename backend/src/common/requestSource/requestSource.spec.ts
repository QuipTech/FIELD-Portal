import {
  getRequestSource,
  parseRequestSource,
  runWithRequestSource,
} from './requestSource';

describe('parseRequestSource', () => {
  it('accepts the known client names only', () => {
    expect(parseRequestSource('web')).toBe('web');
    expect(parseRequestSource(['mobile'])).toBe('mobile');
    expect(parseRequestSource('admin')).toBeUndefined();
    expect(parseRequestSource(undefined)).toBeUndefined();
  });
});

describe('getRequestSource', () => {
  it('is visible across awaits inside the request and gone outside it', async () => {
    const seen = await runWithRequestSource('mobile', async () => {
      await Promise.resolve();
      return getRequestSource();
    });
    expect(seen).toBe('mobile');
    expect(getRequestSource()).toBeUndefined();
  });
});
