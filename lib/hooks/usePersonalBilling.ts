"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPersonalBilling } from "../api/personalBillingApi";
import { getAccessToken } from "../auth/authSession";
import type { PersonalBillingStatus } from "../types/personalBilling";

export const usePersonalBilling = (enabled = true) => {
  const [status, setStatus] = useState<PersonalBillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    const token = getAccessToken();
    if (!enabled || !token) {
      if (mounted.current) { setStatus(null); setLoading(false); }
      return;
    }
    try {
      const next = await getPersonalBilling(token);
      if (mounted.current && sequence.current === request) { setStatus(next); setError(null); }
    } catch (cause) {
      if (mounted.current && sequence.current === request)
        setError(cause instanceof Error ? cause.message : "Unable to check your subscription.");
    } finally {
      if (mounted.current && sequence.current === request) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    mounted.current = true;
    setStatus(null);
    setError(null);
    setLoading(true);
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    window.addEventListener("pageshow", onFocus);
    return () => {
      mounted.current = false;
      sequence.current++;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !status || status.exempt) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, status.paymentRequired ? 15000 : 60000);
    return () => window.clearInterval(timer);
  }, [enabled, status?.paymentRequired, status?.exempt, !!status, refresh]);

  return { status, error, loading, refresh };
};
