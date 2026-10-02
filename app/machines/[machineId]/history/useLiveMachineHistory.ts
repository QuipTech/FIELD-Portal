"use client";

import { useCallback, useEffect, useState } from "react";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import {
  createHistoryEntryRequest,
  deleteMachinePhotoRequest,
  getMachineRequest,
  listMachineHistoryRequest,
} from "@/lib/api/machineHistoryApi";
import { updateMachineStatusRequest } from "@/lib/api/machineFleetApi";
import type { LiveHistoryEntry, LiveHistoryEntryType, MachinePhoto, MachineSummary } from "@/lib/types/machineHistory";
import type { OperatingStatus } from "@/lib/types/machineFleet";

const LOAD_FAILED_MESSAGE = "Couldn't load this machine's history. Please try again.";

const updateEntry = (entries: LiveHistoryEntry[], entryId: string, change: (entry: LiveHistoryEntry) => LiveHistoryEntry) =>
  entries.map((entry) => (entry.id === entryId ? change(entry) : entry));

// A real machine's history from the API. Photo URLs are signed on load and
// expire after 15 minutes; reloading the page signs fresh ones.
export const useLiveMachineHistory = (machineId: string) => {
  const [machine, setMachine] = useState<MachineSummary | null>(null);
  const [entries, setEntries] = useState<LiveHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const accessToken = requireAccessToken();
      const [loadedMachine, loadedEntries] = await Promise.all([
        getMachineRequest(accessToken, machineId),
        listMachineHistoryRequest(accessToken, machineId),
      ]);
      setMachine(loadedMachine);
      setEntries(loadedEntries);
      setLoadError(null);
    } catch (error) {
      setLoadError(toApiErrorMessage(error, LOAD_FAILED_MESSAGE));
    } finally {
      setIsLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Rejects with the API error so the form can show it.
  const createEntry = async (entry: { entryType: LiveHistoryEntryType; description: string }) => {
    const created = await createHistoryEntryRequest(requireAccessToken(), machineId, entry);
    setEntries((current) => [created, ...current]);
  };

  const addPhoto = (entryId: string, photo: MachinePhoto) =>
    setEntries((current) => updateEntry(current, entryId, (entry) => ({ ...entry, photos: [...entry.photos, photo] })));

  const deletePhoto = async (entryId: string, photoId: string) => {
    await deleteMachinePhotoRequest(requireAccessToken(), { machineId, entryId, photoId });
    setEntries((current) =>
      updateEntry(current, entryId, (entry) => ({ ...entry, photos: entry.photos.filter((photo) => photo.id !== photoId) })),
    );
  };

  // Rejects with the API error so the control can show it.
  const changeStatus = async (status: OperatingStatus) => {
    const updated = await updateMachineStatusRequest(requireAccessToken(), machineId, status);
    setMachine((current) => (current ? { ...current, status: updated.status } : current));
  };

  return { machine, entries, isLoading, loadError, createEntry, addPhoto, deletePhoto, changeStatus };
};
