"use client";

import { useEffect } from "react";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import {
  createScheduledReportRequest,
  deleteScheduledReportRequest,
  listScheduledReportsRequest,
  replaceScheduledReportRequest,
  sendScheduledReportNowRequest,
} from "@/lib/api/adminReportsApi";
import type { ScheduledReport, ScheduledReportPayload } from "@/lib/types/adminReports";

const SENDING_POLL_MS = 3000;

// Each action rejects with the API's error so the calling dialog can show
// it; on success the list is updated in place.
export const useScheduledReports = () => {
  const list = useApiResource(listScheduledReportsRequest, [], "Couldn't load scheduled reports. Please try again.");
  const { data, setData } = list;
  const isAnySending = Boolean(data?.isEmailConfigured && data.schedules.some((schedule) => schedule.isSending));

  // Re-checks quietly (no loading state) until every send has finished,
  // so Sent / Failed shows without a page refresh.
  useEffect(() => {
    if (!isAnySending) return;
    const timer = setTimeout(() => {
      listScheduledReportsRequest(requireAccessToken())
        .then(setData)
        .catch(() => undefined);
    }, SENDING_POLL_MS);
    return () => clearTimeout(timer);
  }, [isAnySending, data, setData]);

  const withSchedule = (schedule: ScheduledReport) =>
    setData((current) => {
      if (!current) return current;
      const exists = current.schedules.some((item) => item.id === schedule.id);
      return {
        ...current,
        schedules: exists
          ? current.schedules.map((item) => (item.id === schedule.id ? schedule : item))
          : [...current.schedules, schedule],
      };
    });

  return {
    schedules: data?.schedules ?? [],
    isEmailConfigured: data?.isEmailConfigured ?? true,
    isLoading: list.isLoading,
    loadError: list.error,
    reload: list.reload,
    saveSchedule: async (payload: ScheduledReportPayload, scheduleId?: string) => {
      const token = requireAccessToken();
      withSchedule(
        scheduleId
          ? await replaceScheduledReportRequest(token, scheduleId, payload)
          : await createScheduledReportRequest(token, payload),
      );
    },
    deleteSchedule: async (scheduleId: string) => {
      await deleteScheduledReportRequest(requireAccessToken(), scheduleId);
      setData((current) =>
        current ? { ...current, schedules: current.schedules.filter((item) => item.id !== scheduleId) } : current,
      );
    },
    sendNow: async (scheduleId: string) => {
      withSchedule(await sendScheduledReportNowRequest(requireAccessToken(), scheduleId));
    },
  };
};

export type ScheduledReportsState = ReturnType<typeof useScheduledReports>;
