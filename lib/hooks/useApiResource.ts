"use client";

import { useCallback, useEffect, useState, type DependencyList } from "react";
import { requireAccessToken } from "../api/requireAccessToken";
import { toApiErrorMessage } from "../api/apiErrorMessage";

// Loads one authenticated resource and reloads it whenever `deps` change.
// A response that arrives after a newer load started is ignored.
export const useApiResource = <T>(
  load: (accessToken: string) => Promise<T>,
  deps: DependencyList,
  failedMessage: string,
) => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    const loadResource = async () => {
      const loaded = await load(requireAccessToken());
      if (isCurrent) setData(loaded);
    };
    setIsLoading(true);
    setError(null);
    loadResource()
      .catch((loadError: unknown) => isCurrent && setError(toApiErrorMessage(loadError, failedMessage)))
      .finally(() => isCurrent && setIsLoading(false));
    return () => {
      isCurrent = false;
    };
    // `load` is recreated each render; `deps` is what decides a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return { data, setData, isLoading, error, reload };
};
