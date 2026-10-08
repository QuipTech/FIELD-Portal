"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { ErrorToast } from "@/components/ui/errorToast";
import { toneTagClasses } from "@/components/ui/tone";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { OPERATING_STATUS_OPTIONS, getMachineStatusMeta, toMachineStatus } from "@/lib/format/machineStatus";
import type { OperatingStatus } from "@/lib/types/machineFleet";

interface MachineStatusSelectProps {
  status: string;
  onChange: (status: OperatingStatus) => Promise<void>;
}

// The machine's status tag; with machine.manage it's also the control to
// change it (each change is recorded for the dashboard's fleet uptime).
export const MachineStatusSelect = ({ status, onChange }: MachineStatusSelectProps) => {
  const { isLoaded, can } = usePermissions();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = getMachineStatusMeta(toMachineStatus(status));

  if (!isLoaded || !can(PERMISSIONS.manageMachine)) {
    return (
      <Tag tone={meta.tone}>
        {status === "down" && <Icon name="alert" className="h-3.5 w-3.5" />}
        {meta.label}
      </Tag>
    );
  }

  const handleChange = async (next: OperatingStatus) => {
    setIsSaving(true);
    setError(null);
    try {
      await onChange(next);
    } catch (changeError) {
      setError(toApiErrorMessage(changeError, "Couldn't change the status. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <label className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${toneTagClasses[meta.tone]}`}>
        {status === "down" && <Icon name="alert" className="h-3.5 w-3.5" />}
        <select
          value={status}
          disabled={isSaving}
          onChange={(event) => handleChange(event.target.value as OperatingStatus)}
          aria-label="Machine status"
          className="cursor-pointer bg-transparent outline-none disabled:cursor-wait"
        >
          {OPERATING_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {error && <ErrorToast key={error} message={error} onDismiss={() => setError(null)} />}
    </>
  );
};
