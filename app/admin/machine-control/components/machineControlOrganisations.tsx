"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons/icon";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorToast } from "@/components/ui/errorToast";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { SavedToast } from "@/components/ui/savedToast";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { Switch } from "@/components/ui/switch";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import {
  listMachineControlOrganisationsRequest,
  setMachineControlRequest,
  type MachineControlOrganisation,
} from "@/lib/api/adminMachineControlApi";
import { useApiResource } from "@/lib/hooks/useApiResource";

const SEARCH_DELAY_MS = 300;

// The platform administrator's switch for each organisation. Turning it off
// asks first; turning it on is instant.
export const MachineControlOrganisations = () => {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [turningOff, setTurningOff] = useState<MachineControlOrganisation | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const organisations = useApiResource(() => listMachineControlOrganisationsRequest(query), [query], "Couldn't load organisations.");
  const rows = organisations.data ?? [];
  const enabledCount = rows.filter((row) => row.machineControlEnabled).length;

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const save = async (organisation: MachineControlOrganisation, enabled: boolean) => {
    setSavingId(organisation.id);
    try {
      await setMachineControlRequest(organisation.id, enabled);
      organisations.setData(rows.map((row) => (row.id === organisation.id ? { ...row, machineControlEnabled: enabled } : row)));
      setNotice(`Machine Control ${enabled ? "turned on" : "turned off"} for ${organisation.name}`);
    } catch (error) {
      setFailure(toApiErrorMessage(error, "Couldn't change Machine Control. Please try again."));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-[20px] font-medium text-ink">
            <Icon name="broadcast" className="h-5 w-5 stroke-primaryHover" />
            Machine Control
          </h1>
          <p className="text-sm text-bodyGray">Turn Machine Control on for an organisation. Its people then see it in their sidebar, as their roles allow.</p>
        </div>
        {organisations.data && <span className="ml-auto text-sm text-mutedGray">On for {enabledCount} of {rows.length} shown</span>}
      </div>
      <Input icon="search" aria-label="Search organisations" placeholder="Search organisations" value={search} onChange={(event) => setSearch(event.target.value)} className="max-w-sm" />
      {organisations.isLoading && !organisations.data && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((row) => (
            <SkeletonBar key={row} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}
      {organisations.error && !organisations.data && <LoadErrorState message={organisations.error} onRetry={organisations.reload} />}
      {organisations.data && rows.length === 0 && <EmptyState icon="search" title="No organisations match" description="Try another name." />}
      <div className="flex flex-col gap-2">
        {rows.map((organisation) => (
          <div
            key={organisation.id}
            className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${
              organisation.machineControlEnabled ? "border-primaryBorder bg-primaryTint" : "border-borderGray bg-surface"
            }`}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-medium text-ink">{organisation.name}</span>
              <span className="text-xs text-mutedGray">
                {organisation.activeMachineCount} active {organisation.activeMachineCount === 1 ? "machine" : "machines"} ·{" "}
                {organisation.connectedDeviceCount} {organisation.connectedDeviceCount === 1 ? "tablet" : "tablets"} connected
              </span>
            </span>
            <span className={`text-sm ${organisation.machineControlEnabled ? "font-medium text-primaryHover" : "text-mutedGray"}`}>
              {organisation.machineControlEnabled ? "On" : "Off"}
            </span>
            <span aria-label={`Machine Control for ${organisation.name}`}>
              <Switch
                on={organisation.machineControlEnabled}
                disabled={savingId === organisation.id}
                onToggle={() => (organisation.machineControlEnabled ? setTurningOff(organisation) : void save(organisation, true))}
              />
            </span>
          </div>
        ))}
      </div>
      {turningOff && (
        <ConfirmDialog
          title={`Turn off Machine Control for ${turningOff.name}?`}
          confirmLabel="Turn off"
          onConfirm={async () => {
            await save(turningOff, false);
            setTurningOff(null);
          }}
          onClose={() => setTurningOff(null)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't turn it off. Please try again.")}
        >
          Its people stop seeing Machine Control, and codes still waiting for a tablet stop working. Tablets already connected stay paired, so turning it back on picks up where they left off.
        </ConfirmDialog>
      )}
      {notice && <SavedToast key={notice} message={notice} onDismiss={() => setNotice(null)} />}
      {failure && <ErrorToast key={failure} message={failure} onDismiss={() => setFailure(null)} />}
    </section>
  );
};
