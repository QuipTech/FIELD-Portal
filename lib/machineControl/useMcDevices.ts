"use client";

import { useEffect } from "react";
import { listMcDevicesRequest } from "../api/machineControlApi";
import { useApiResource } from "../hooks/useApiResource";

// Refresh pairing and live presence without a manual page reload.
const REFRESH_EVERY_MS = 5_000;

export const useMcDevices = () => {
  const devices = useApiResource(listMcDevicesRequest, [], "Couldn't load your machines' tablets.");
  const { reload, isLoading } = devices;

  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(reload, REFRESH_EVERY_MS);
    return () => clearTimeout(timer);
  }, [reload, isLoading]);

  return devices;
};
