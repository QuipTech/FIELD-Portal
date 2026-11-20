"use client";

import { useCallback, useEffect, useState } from "react";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { listDesigns, type Delivery, type DesignVersion } from "@/lib/api/machineDesignApi";
import { listMachineDocumentsRequest } from "@/lib/api/machineDocumentsApi";
import { listMachineHistoryRequest } from "@/lib/api/machineHistoryApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import type { MachineDocument } from "@/lib/types/machineDocument";
import type { RemoteSessionSummary } from "@/lib/types/remoteSession";

const SESSION_LIMIT = 200;

export type ActivityItem =
  | { kind: "session"; id: string; at: string; session: RemoteSessionSummary }
  | { kind: "received"; id: string; at: string; document: MachineDocument }
  | { kind: "sent"; id: string; at: string; delivery: Delivery; version: DesignVersion | null };

export type ActivityKind = ActivityItem["kind"];

interface ActivityState {
  items: ActivityItem[];
  // One message per source that couldn't be read; the rest still shows.
  problems: string[];
  isLoading: boolean;
}

// Everything that went between the Portal and this machine's tablet, newest
// first: remote sessions (from History, with their recordings), files the
// tablet sent (Documents with fromTablet), and designs sent to it.
export const useMachineAppActivity = (machineId: string, canSeeSentFiles: boolean) => {
  const [state, setState] = useState<ActivityState>({ items: [], problems: [], isLoading: true });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let current = true;
    setState((previous) => ({ ...previous, isLoading: true }));
    const load = async () => {
      const token = requireAccessToken();
      const [history, documents, designs] = await Promise.allSettled([
        listMachineHistoryRequest(token, machineId, { type: "remote_session", limit: SESSION_LIMIT }),
        listMachineDocumentsRequest(token, machineId),
        canSeeSentFiles ? listDesigns(token) : Promise.resolve(null),
      ]);
      const items: ActivityItem[] = [];
      const problems: string[] = [];

      if (history.status === "fulfilled") {
        for (const entry of history.value) {
          if (!entry.remoteSession) continue;
          items.push({
            kind: "session",
            id: `session-${entry.remoteSession.id}`,
            at: entry.remoteSession.startedAt ?? entry.createdAt,
            session: entry.remoteSession,
          });
        }
      } else {
        problems.push(toApiErrorMessage(history.reason, "Couldn't load remote sessions."));
      }

      if (documents.status === "fulfilled") {
        for (const document of documents.value) {
          if (document.fromTablet) {
            items.push({ kind: "received", id: `received-${document.id}`, at: document.uploadedAt, document });
          }
        }
      } else {
        problems.push(toApiErrorMessage(documents.reason, "Couldn't load files from the tablet."));
      }

      if (designs.status === "fulfilled" && designs.value) {
        const versions = new Map(designs.value.versions.map((version) => [version.id, version]));
        for (const delivery of designs.value.deliveries) {
          if (delivery.machineId !== machineId) continue;
          items.push({
            kind: "sent",
            id: `sent-${delivery.id}`,
            at: delivery.createdAt,
            delivery,
            version: versions.get(delivery.versionId) ?? null,
          });
        }
      } else if (designs.status === "rejected") {
        problems.push(toApiErrorMessage(designs.reason, "Couldn't load files sent to the tablet."));
      }

      items.sort((a, b) => b.at.localeCompare(a.at));
      if (current) setState({ items, problems, isLoading: false });
    };
    load().catch((error: unknown) => {
      if (current) setState({ items: [], problems: [toApiErrorMessage(error, "Couldn't load activity.")], isLoading: false });
    });
    return () => {
      current = false;
    };
  }, [machineId, canSeeSentFiles, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { ...state, reload };
};
