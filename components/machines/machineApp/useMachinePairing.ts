"use client";

import { useCallback, useEffect, useState } from "react";
import { createPairingCodeRequest, getMachineAppConnectionRequest } from "@/lib/api/machineAppConnectionApi";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";

const CHECK_EVERY_MS = 3000;
const TICK_EVERY_MS = 1000;

export type PairingState =
  | { step: "loading" }
  | { step: "waiting"; code: string; expiresAt: string }
  | { step: "expired" }
  | { step: "connected" }
  | { step: "failed"; message: string };

// Gets a code for one machine, then checks until a tablet has used it. A failed
// check is ignored, since the next one tries again; expiry ends the wait.
export const useMachinePairing = (machineId: string) => {
  const [state, setState] = useState<PairingState>({ step: "loading" });
  const [now, setNow] = useState(() => Date.now());
  const isWaiting = state.step === "waiting";
  const expiresAt = state.step === "waiting" ? state.expiresAt : null;

  const requestCode = useCallback(async () => {
    setState({ step: "loading" });
    try {
      const result = await createPairingCodeRequest(machineId);
      setNow(Date.now());
      if (result.connected || !result.code || !result.expiresAt) setState({ step: "connected" });
      else setState({ step: "waiting", code: result.code, expiresAt: result.expiresAt });
    } catch (error) {
      setState({ step: "failed", message: toApiErrorMessage(error, "Couldn't create a pairing code. Please try again.") });
    }
  }, [machineId]);

  useEffect(() => {
    void requestCode();
  }, [requestCode]);

  useEffect(() => {
    if (!isWaiting) return;
    let isCurrent = true;
    const check = setInterval(() => {
      getMachineAppConnectionRequest(machineId)
        .then((connection) => {
          if (isCurrent && connection.connected) setState({ step: "connected" });
        })
        .catch(() => undefined);
    }, CHECK_EVERY_MS);
    return () => {
      isCurrent = false;
      clearInterval(check);
    };
  }, [isWaiting, machineId]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= Date.parse(expiresAt)) setState({ step: "expired" });
    }, TICK_EVERY_MS);
    return () => clearInterval(tick);
  }, [expiresAt]);

  return { state, now, requestCode };
};
