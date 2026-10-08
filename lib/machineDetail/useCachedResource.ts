"use client";

import { useCallback, useEffect, useState } from "react";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { loadCached, readCached, writeCached } from "./resourceCache";

// Like useApiResource, backed by the machine detail cache: cached data
// shows immediately and is refreshed in the background when stale. A null
// key loads nothing. isLoading is only true while there's nothing to show.
export const useCachedResource = <T>(key: string | null, load: () => Promise<T>, failedMessage: string) => {
  const [data, setDataState] = useState<T | null>(() => (key ? readCached<T>(key)?.data ?? null : null));
  const [isLoading, setIsLoading] = useState(() => Boolean(key) && !(key && readCached<T>(key)));
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!key) return;
    let isCurrent = true;
    const cached = readCached<T>(key);
    setDataState(cached?.data ?? null);
    setError(null);
    if (cached?.isFresh && reloadCount === 0) {
      setIsLoading(false);
      return;
    }
    setIsLoading(!cached);
    loadCached(key, load)
      .then((loaded) => isCurrent && setDataState(loaded))
      .catch((loadError: unknown) => isCurrent && setError(toApiErrorMessage(loadError, failedMessage)))
      .finally(() => isCurrent && setIsLoading(false));
    return () => {
      isCurrent = false;
    };
    // `load` is recreated each render; the key decides what's loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadCount]);

  const setData = useCallback(
    (next: T) => {
      if (key) writeCached(key, next);
      setDataState(next);
    },
    [key],
  );
  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return { data, setData, isLoading, error, reload };
};
