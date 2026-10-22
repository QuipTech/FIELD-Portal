"use client";

import { useEffect, useSyncExternalStore } from "react";
import { requireAccessToken } from "../api/requireAccessToken";
import { toApiErrorMessage } from "../api/apiErrorMessage";
import { getStoredUser } from "../auth/authSession";

// Data older than this is shown at once but refetched in the background.
const FRESH_MS = 30_000;

interface Entry {
  data?: unknown;
  error?: string;
  loadedAt?: number;
  pending?: Promise<void>;
}

// One in-memory cache for the tab, shared by every component using the same key.
// It belongs to the signed-in user and is dropped when a different user signs in.
let owner: string | undefined;
let entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const currentEntries = () => {
  const user = getStoredUser()?.id ?? "";
  if (user !== owner) {
    owner = user;
    entries = new Map();
  }
  return entries;
};

// Loads `key` unless a fresh copy is cached or a load is already running.
// `force` skips the freshness check, e.g. right after an edit.
export const loadCached = <T>(
  key: string,
  load: (accessToken: string) => Promise<T>,
  failedMessage: string,
  force = false,
): Promise<void> => {
  const cache = currentEntries();
  const entry = cache.get(key) ?? {};
  // A forced load waits for one already running, which may predate the edit, then loads again.
  if (entry.pending)
    return force ? entry.pending.then(() => loadCached(key, load, failedMessage, true)) : entry.pending;
  if (!force && entry.loadedAt && Date.now() - entry.loadedAt < FRESH_MS) return Promise.resolve();
  const pending = (async () => {
    try {
      const data = await load(requireAccessToken());
      cache.set(key, { data, loadedAt: Date.now() });
    } catch (error) {
      // Keep showing the last good data; only surface the error when there is none.
      cache.set(key, { ...cache.get(key), pending: undefined, error: toApiErrorMessage(error, failedMessage) });
    }
    notify();
  })();
  cache.set(key, { ...entry, pending });
  return pending;
};

// Fills `key` with data fetched some other way (e.g. as part of a bigger list),
// unless a load of its own is running.
export const primeCached = (key: string, data: unknown) => {
  const cache = currentEntries();
  if (cache.get(key)?.pending) return;
  cache.set(key, { data, loadedAt: Date.now() });
  notify();
};

export const useCachedResource =<T>(
  key: string | null,
  load: (accessToken: string) => Promise<T>,
  failedMessage: string,
) => {
  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? currentEntries().get(key) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (key) void loadCached(key, load, failedMessage);
    // `load` is recreated each render; the key decides what is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return {
    data: entry?.data as T | undefined,
    isLoading: Boolean(key) && entry?.data === undefined && !entry?.error,
    error: entry?.data === undefined ? (entry?.error ?? null) : null,
  };
};
