// An in-memory cache for the machine detail screens, so switching tabs
// shows what was already loaded (or prefetched) at once, and the same
// request made by two components at the same moment is sent only once.
// Lives for the browser tab; a reload starts empty.
interface CacheEntry {
  data?: unknown;
  fetchedAt: number;
  pending?: Promise<unknown>;
}

// Data this recent is shown without asking the server again.
export const FRESH_FOR_MS = 30_000;

const entries = new Map<string, CacheEntry>();

export const readCached = <T>(key: string): { data: T; isFresh: boolean } | null => {
  const entry = entries.get(key);
  if (!entry || entry.data === undefined) return null;
  return { data: entry.data as T, isFresh: Date.now() - entry.fetchedAt < FRESH_FOR_MS };
};

export const writeCached = <T>(key: string, data: T): void => {
  entries.set(key, { ...entries.get(key), data, fetchedAt: Date.now() });
};

// Runs `load` unless the same key is already loading, then caches it.
export const loadCached = <T>(key: string, load: () => Promise<T>): Promise<T> => {
  const existing = entries.get(key);
  if (existing?.pending) return existing.pending as Promise<T>;
  const pending = load()
    .then((data) => {
      entries.set(key, { data, fetchedAt: Date.now() });
      return data;
    })
    .finally(() => {
      const entry = entries.get(key);
      if (entry?.pending === pending) entries.set(key, { ...entry, pending: undefined });
    });
  entries.set(key, { ...existing, fetchedAt: existing?.fetchedAt ?? 0, pending });
  return pending;
};

// Fetches into the cache unless fresh data is there; errors are left for
// whichever screen asks for the data to report.
export const prefetchCached = <T>(key: string, load: () => Promise<T>): void => {
  if (readCached(key)?.isFresh) return;
  loadCached(key, load).catch(() => undefined);
};

// Drops every entry whose key starts with the prefix, e.g. after a write.
export const invalidateCached = (keyPrefix: string): void => {
  Array.from(entries.keys())
    .filter((key) => key.startsWith(keyPrefix))
    .forEach((key) => entries.delete(key));
};
