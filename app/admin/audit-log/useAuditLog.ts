"use client";

import { useState } from "react";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { exportAuditLogRequest, listAuditLogFiltersRequest, listAuditLogRequest } from "@/lib/api/auditLogApi";
import { saveBlobAsFile } from "@/lib/format/saveBlobAsFile";
import type { AuditLogFilters } from "@/lib/types/auditLog";

export const PAGE_SIZE = 50;

export const TIME_RANGES = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;
export type TimeRange = (typeof TIME_RANGES)[number]["value"];

// Worked out at request time, so "last 7 days" is always relative to now.
const rangeStart = (range: TimeRange): string | null =>
  range === "all" ? null : new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000).toISOString();

export const useAuditLog = () => {
  const [actorId, setActorId] = useState("");
  const [eventType, setEventType] = useState("");
  const [range, setRange] = useState<TimeRange>("7");
  const [page, setPage] = useState(1);
  const currentFilters = (): AuditLogFilters => ({ actorId, eventType, from: rangeStart(range) });

  const events = useApiResource(
    (accessToken) => listAuditLogRequest(accessToken, currentFilters(), page, PAGE_SIZE),
    [actorId, eventType, range, page],
    "Couldn't load the audit log. Please try again.",
  );
  const options = useApiResource(listAuditLogFiltersRequest, [], "Couldn't load the filter options.");

  // Any filter change starts again from the first page.
  const withFirstPage =
    <T>(setFilter: (value: T) => void) =>
    (value: T) => {
      setFilter(value);
      setPage(1);
    };

  // Rejects with the API's error so the caller can show it. Resolves to
  // whether the export was cut short (too many matching events).
  const exportCsv = async (): Promise<boolean> => {
    const { blob, isTruncated } = await exportAuditLogRequest(requireAccessToken(), currentFilters());
    saveBlobAsFile(blob, `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
    return isTruncated;
  };

  return {
    actorId,
    setActorId: withFirstPage(setActorId),
    eventType,
    setEventType: withFirstPage(setEventType),
    range,
    setRange: withFirstPage(setRange),
    page,
    setPage,
    events: events.data,
    isLoading: events.isLoading,
    loadError: events.error,
    filterOptions: options.data,
    exportCsv,
  };
};
