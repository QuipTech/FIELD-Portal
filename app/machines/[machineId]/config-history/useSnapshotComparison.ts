"use client";

import { useEffect, useState } from "react";
import { useCachedResource } from "@/lib/machineDetail/useCachedResource";
import { machineCacheKeys } from "@/lib/machineDetail/machineDetailCacheKeys";
import type { MachineDetailService } from "@/lib/types/machineDetailService";
import type { Snapshot } from "@/lib/types/configurationDiff";

const COMPARE_COUNT = 2;

// Two ids, older first, so the diff always reads older → newer.
const orderPair = (ids: string[], snapshots: Snapshot[]): [string, string] | null => {
  const [first, second] = ids.map((id) => snapshots.find((snapshot) => snapshot.id === id));
  if (!first || !second) return null;
  return first.takenAt <= second.takenAt ? [first.id, second.id] : [second.id, first.id];
};

// The latest snapshot against the newest one marked good (else the one
// before it): "what changed since it last worked".
const pickDefaultPair = (snapshots: Snapshot[]): string[] => {
  const [latest] = snapshots;
  const lastGood = snapshots.find((snapshot) => snapshot.isKnownGood && snapshot.id !== latest?.id) ?? snapshots[1];
  return latest && lastGood ? [latest.id, lastGood.id] : [];
};

// Snapshot selection (exactly two; a third replaces the earliest picked)
// and the diff of the last compared pair.
export const useSnapshotComparison = (service: MachineDetailService, machineId: string) => {
  const snapshots = useCachedResource(machineCacheKeys.snapshots(machineId), () => service.listSnapshots(machineId), "Couldn't load snapshots.");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparedPair, setComparedPair] = useState<[string, string] | null>(null);
  const [hasPickedDefaults, setHasPickedDefaults] = useState(false);
  const list = snapshots.data ?? [];

  useEffect(() => {
    if (!snapshots.data || hasPickedDefaults) return;
    const defaults = pickDefaultPair(snapshots.data);
    setSelectedIds(defaults);
    setComparedPair(orderPair(defaults, snapshots.data));
    setHasPickedDefaults(true);
  }, [snapshots.data, hasPickedDefaults]);

  const diff = useCachedResource(
    comparedPair ? machineCacheKeys.diff(machineId, ...comparedPair) : null,
    () => service.getSnapshotDiff(machineId, ...(comparedPair as [string, string])),
    "Couldn't compare these snapshots.",
  );

  const toggleSnapshot = (id: string) =>
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((selectedId) => selectedId !== id);
      return current.length >= COMPARE_COUNT ? [...current.slice(1), id] : [...current, id];
    });

  const compareSelected = () => setComparedPair(orderPair(selectedIds, list));

  // Selects a snapshot marked good against the latest one and compares.
  const compareWithLatest = (goodId: string) => {
    const latestId = list[0]?.id;
    if (!latestId || latestId === goodId) return;
    setSelectedIds([latestId, goodId]);
    setComparedPair(orderPair([latestId, goodId], list));
  };

  // Rejects with the API error so the caller can show it.
  const takeSnapshot = async () => {
    const taken = await service.takeSnapshot(machineId);
    snapshots.setData([taken, ...list]);
  };

  const toggleKnownGood = async (snapshot: Snapshot) => {
    const updated = await service.setSnapshotKnownGood(machineId, snapshot.id, !snapshot.isKnownGood);
    snapshots.setData(list.map((item) => (item.id === updated.id ? updated : item)));
  };

  return {
    snapshots,
    selectedIds,
    canCompare: selectedIds.length === COMPARE_COUNT,
    toggleSnapshot,
    compareSelected,
    compareWithLatest,
    takeSnapshot,
    toggleKnownGood,
    diff,
  };
};
