"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Modal } from "@/components/ui/modal";
import { Tag } from "@/components/ui/tag";
import { EMPTY_MACHINE_FILTERS, listMachinesRequest } from "@/lib/api/machineFleetApi";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { canContributeTo } from "@/lib/machineDetail/machineAccessRules";
import type { FleetMachine } from "@/lib/types/machineFleet";

interface ConnectMachinePickerProps {
  onPick: (machine: FleetMachine) => void;
  onClose: () => void;
}

const SEARCH_DELAY_MS = 300;

// Why a machine can't be picked, or null when it can.
const unavailableReason = (machine: FleetMachine): string | null => {
  if (machine.appConnected) return "Connected";
  if (machine.lifecycleState && machine.lifecycleState !== "active") return "Not active";
  if (!canContributeTo(machine)) return "View only";
  return null;
};

// Step one of connecting: which machine the tablet belongs to.
export const ConnectMachinePicker = ({ onPick, onClose }: ConnectMachinePickerProps) => {
  const [search, setSearch] = useState("");
  const [machines, setMachines] = useState<FleetMachine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const timer = setTimeout(() => {
      listMachinesRequest(requireAccessToken(), EMPTY_MACHINE_FILTERS, search)
        .then((list) => isCurrent && setMachines(list.items))
        .catch((loadError: unknown) => isCurrent && setError(toApiErrorMessage(loadError, "Couldn't load your machines.")));
    }, SEARCH_DELAY_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <Modal title="Connect a machine" onClose={onClose} widthClassName="w-[520px]">
      <div className="flex flex-col gap-3 p-5">
        <p className="text-sm text-bodyGray">Pick the machine whose tablet you want to connect. You&apos;ll get a 6-digit code to enter on it.</p>
        <Input icon="search" placeholder="Search by Plant ID, serial, make or site" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
        <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto">
          {error && <p role="alert" className="p-4 text-center text-sm text-danger">{error}</p>}
          {!error && machines === null && (
            <div className="flex justify-center py-8 text-mutedGray">
              <LoadingSpinner size="md" />
            </div>
          )}
          {machines?.length === 0 && <p className="p-6 text-center text-sm text-mutedGray">No machines match &ldquo;{search}&rdquo;.</p>}
          {machines?.map((machine) => {
            const reason = unavailableReason(machine);
            return (
              <button
                key={machine.id}
                type="button"
                disabled={reason !== null}
                onClick={() => onPick(machine)}
                className="group flex items-center gap-3 rounded-xl border border-borderGray px-3 py-2.5 text-left transition-colors hover:border-primaryBorder hover:bg-primaryTint disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-borderGray disabled:hover:bg-transparent"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-fillGray text-bodyGray group-enabled:group-hover:bg-primary group-enabled:group-hover:text-white">
                  <Icon name="truck" className="h-4 w-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-medium text-ink">{machine.label}</span>
                  <span className="truncate text-xs text-mutedGray">
                    {machine.manufacturer} {machine.model}
                    {machine.site ? ` · ${machine.site}` : ""}
                  </span>
                </span>
                {reason ? <Tag>{reason}</Tag> : <Icon name="chevr" className="h-4 w-4 stroke-mutedGray" />}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
