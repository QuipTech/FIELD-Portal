import { AsyncLocalStorage } from 'async_hooks';

export type RequestSource = 'web' | 'mobile';

export const REQUEST_SOURCE_HEADER = 'x-field-client';

const requestSourceStorage = new AsyncLocalStorage<{
  source?: RequestSource;
}>();

// Anything other than a known client name is treated as unknown rather
// than trusted, since the header is client-supplied.
export const parseRequestSource = (
  headerValue: string | string[] | undefined,
): RequestSource | undefined => {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return value === 'web' || value === 'mobile' ? value : undefined;
};

export const runWithRequestSource = <T>(
  source: RequestSource | undefined,
  work: () => T,
): T => requestSourceStorage.run({ source }, work);

// The client behind the current request; undefined outside a request
// (e.g. background workers) or when the client didn't say.
export const getRequestSource = (): RequestSource | undefined =>
  requestSourceStorage.getStore()?.source;
