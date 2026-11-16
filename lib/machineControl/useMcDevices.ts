"use client";

import { useEffect } from "react";
import { listMcDevicesRequest } from "../api/machineControlApi";
import { useApiResource } from "../hooks/useApiResource";

// Tablets report every 30 seconds, so their online status is re-read as often.
const REFRESH_EVERY_MS = 30_000;

export const useMcDevices = () => {
  const devices = useApiResource(listMcDevicesRequest, [], "Couldn't load your machines' tablets.");
  const { reload } = devices;

  useEffect(() => {
    const timer = setInterval(reload, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [reload]);

  return devices;
};
