"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { searchPlatformMachinesRequest } from "@/lib/api/adminMachineGroupsApi";
import type { PlatformMachine } from "@/lib/types/machineGroup";

interface PlatformMachinePickerProps {
  selectedIds: string[];
  onToggle: (machineId: string) => void;
  // Already in the group: shown ticked and disabled.
  existingIds?: string[];
  disabled?: boolean;
}

const SEARCH_DELAY_MS = 300;

// Every organisation's machines, searchable by plant ID, serial, VIN or
// organisation, to tick for a machine group.
export const PlatformMachinePicker = ({ selectedIds, onToggle, existingIds = [], disabled }: PlatformMachinePickerProps) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PlatformMachine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const timer = setTimeout(() => {
      setError(null);
      searchPlatformMachinesRequest(requireAccessToken(), search.trim())
        .then((found) => isCurrent && setResults(found))
        .catch((searchError: unknown) => isCurrent && setError(toApiErrorMessage(searchError, "Couldn't search machines.")));
    }, SEARCH_DELAY_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <div className="flex flex-col gap-2">
      <Input
        icon="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Plant ID, serial, VIN or organisation"
      />
      <div className="flex max-h-72 flex-col overflow-y-auto rounded-lg border border-borderGray">
        {error && <p className="p-4 text-sm text-danger">{error}</p>}
        {!results && !error && (
          <div className="flex justify-center p-6 text-mutedGray">
            <LoadingSpinner />
          </div>
        )}
        {results?.length === 0 && <p className="p-4 text-sm text-mutedGray">No machines match.</p>}
        {results?.map((machine) => {
          const isInGroup = existingIds.includes(machine.id);
          return (
            <label key={machine.id} className="flex items-center gap-3 border-b border-borderGray px-3 py-2.5 text-sm last:border-b-0">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={isInGroup || selectedIds.includes(machine.id)}
                disabled={isInGroup || disabled}
                onChange={() => onToggle(machine.id)}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-ink">{machine.label}</span>
                <span className="truncate text-xs text-mutedGray">
                  {machine.manufacturer} {machine.model} · {machine.serialNumber}
                  {machine.registrationNumber ? ` · ${machine.registrationNumber}` : ""}
                </span>
              </span>
              <span className="flex-none text-xs text-bodyGray">{isInGroup ? "In group" : machine.owningOrganisation.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};
