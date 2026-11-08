"use client";

import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { PermissionButton } from "@/components/auth/permissionButton";
import { Button } from "@/components/ui/button";
import { ManageMachineGroupsModal } from "@/components/machines/manageMachineGroupsModal";
import { usePermissions } from "@/lib/auth/usePermissions";
import { MachineSharingBadges } from "@/components/machines/machineSharingBadges";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { getInitials } from "@/lib/format/nameInitials";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { useMachineDetail } from "../machineDetailContext";
import { isOwnMachine } from "@/lib/machineDetail/machineAccessRules";
import { EditMachineModal } from "./editMachineModal";
import { EditIdentifierModal, type MachineIdentifier } from "./editIdentifierModal";

const readingFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

// "Read 19 Mar 06:00".
const formatReadAt = (isoDate: string) => `Read ${readingFormat.format(new Date(isoDate)).replace(",", "")}`;

const SpecRow = ({ label, value, aside }: { label: string; value: ReactNode; aside?: ReactNode }) => (
  <div className="flex items-center gap-3 border-b border-borderGray py-2.5 last:border-b-0">
    <span className="w-24 flex-none text-xs font-medium uppercase tracking-wide text-mutedGray">{label}</span>
    <span className="min-w-0 truncate text-[15px] text-ink">{value}</span>
    {aside && <span className="ml-auto flex flex-none items-center gap-1 text-xs text-mutedGray">{aside}</span>}
  </div>
);

// Copies `value`, confirming with a toast named after `what`.
const CopyButton = ({ value, what }: { value: string; what: string }) => {
  const { notify, notifyError } = useMachineDetail();
  const copy = () =>
    navigator.clipboard
      .writeText(value)
      .then(() => notify(`${what} copied`))
      .catch(() => notifyError(`Couldn't copy the ${what.toLowerCase()}.`));
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${what.toLowerCase()}`}
      className="rounded-md border border-borderGrayStrong bg-fillGray px-2 py-0.5 text-xs text-bodyGray hover:text-ink"
    >
      Copy
    </button>
  );
};

// Opens the editor for one row's value; styled like CopyButton beside it.
const EditButton = ({ what, onClick }: { what: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Edit ${what.toLowerCase()}`}
    className="rounded-md border border-borderGrayStrong bg-fillGray px-2 py-0.5 text-xs text-bodyGray hover:text-ink"
  >
    Edit
  </button>
);

export const MachineSpecList = () => {
  const { machine, reloadMachine, notify } = useMachineDetail();
  const [isEditing, setIsEditing] = useState(false);
  // Which field the Edit machine dialog starts in, when opened from a row.
  const [editFocus, setEditFocus] = useState<"site" | undefined>(undefined);
  const [editingIdentifier, setEditingIdentifier] = useState<MachineIdentifier | null>(null);
  const [isManagingGroups, setIsManagingGroups] = useState(false);
  const { isLoaded, can } = usePermissions();
  const canManageGroups = isLoaded && can(PERMISSIONS.managePlatform);
  if (!machine) return <SkeletonBar className="h-[260px] min-w-[280px] flex-1 rounded-xl" />;
  // Row Edit buttons: the owning organisation with "Edit machine records", or
  // the platform administrator on another organisation's machine (Plant ID,
  // serial and site only; the API enforces both).
  const isSharedAdminEdit = machine.isShared && canManageGroups;
  const canEdit = (isOwnMachine(machine) && isLoaded && can(PERMISSIONS.manageMachine)) || isSharedAdminEdit;
  const openEdit = (focus?: "site") => {
    setEditFocus(focus);
    setIsEditing(true);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-borderGray bg-surface px-3.5">
      <SpecRow
        label="Plant ID"
        value={machine.plantId ? <span className="font-mono">{machine.plantId}</span> : "—"}
        aside={
          (machine.plantId || canEdit) && (
            <>
              {canEdit && <EditButton what="Plant ID" onClick={() => setEditingIdentifier("plantId")} />}
              {machine.plantId && <CopyButton value={machine.plantId} what="Plant ID" />}
            </>
          )
        }
      />
      <SpecRow
        label="Serial"
        value={<span className="font-mono">{machine.serialNumber}</span>}
        aside={
          <>
            {canEdit && <EditButton what="Serial number" onClick={() => setEditingIdentifier("serialNumber")} />}
            <CopyButton value={machine.serialNumber} what="Serial number" />
          </>
        }
      />
      <SpecRow
        label="Hours"
        value={machine.operatingHours === null ? "—" : `${machine.operatingHours.toLocaleString()} h`}
        aside={machine.hoursReadAt && formatReadAt(machine.hoursReadAt)}
      />
      <SpecRow label="Site" value={machine.site ?? "—"} aside={canEdit && <EditButton what="Site" onClick={() => openEdit("site")} />} />
      <SpecRow label="Groups" value={<MachineSharingBadges machine={machine} emptyLabel="None" />} />
      <SpecRow
        label={machine.isShared ? "Owned by" : "Owner"}
        value={machine.isShared ? machine.owningOrganisationName : (machine.owner?.name ?? "Unassigned")}
        aside={machine.owner && <Avatar initials={getInitials(machine.owner.name)} imageSrc={machine.owner.avatarUrl ?? undefined} size="sm" />}
      />
      {(isOwnMachine(machine) || canManageGroups) && (
        <div className="flex justify-end gap-2 py-2.5">
          {canManageGroups && (
            <Button size="sm" variant="ghost" onClick={() => setIsManagingGroups(true)}>
              Manage groups
            </Button>
          )}
          {isOwnMachine(machine) && (
            <PermissionButton permission={PERMISSIONS.manageMachine} size="sm" onClick={() => openEdit()}>
              Edit machine
            </PermissionButton>
          )}
        </div>
      )}
      {isManagingGroups && (
        <ManageMachineGroupsModal
          machine={{ id: machine.id, label: machine.plantId ?? machine.serialNumber }}
          onSaved={(message) => {
            reloadMachine();
            notify(message);
          }}
          onClose={() => setIsManagingGroups(false)}
        />
      )}
      {isEditing && (
        <EditMachineModal
          machine={machine}
          focus={editFocus}
          siteOnly={isSharedAdminEdit}
          onSaved={() => {
            reloadMachine();
            notify("Machine saved");
          }}
          onClose={() => setIsEditing(false)}
        />
      )}
      {editingIdentifier && (
        <EditIdentifierModal
          machineId={machine.id}
          identifier={editingIdentifier}
          currentValue={editingIdentifier === "plantId" ? machine.plantId : machine.serialNumber}
          onSaved={() => {
            reloadMachine();
            notify(editingIdentifier === "plantId" ? "Plant ID saved" : "Serial number saved");
          }}
          onClose={() => setEditingIdentifier(null)}
        />
      )}
    </div>
  );
};
