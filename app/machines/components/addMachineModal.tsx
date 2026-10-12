"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getMachineCatalogRequest, registerMachineRequest } from "@/lib/api/machineFleetApi";
import { OPERATING_STATUS_OPTIONS } from "@/lib/format/machineStatus";
import type { OperatingStatus } from "@/lib/types/machineFleet";

interface AddMachineModalProps {
  onClose: () => void;
  onRegistered: () => void;
}

const selectClasses = "h-10 w-full rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink disabled:bg-fillGray";

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-1 flex-col gap-1.5">
    <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">{label}</span>
    {children}
  </label>
);

// Registers a machine against a model from the Machine library (curated
// by QuipTech admins), so it inherits the model's systems and components.
export const AddMachineModal = ({ onClose, onRegistered }: AddMachineModalProps) => {
  const catalog = useApiResource(getMachineCatalogRequest, [], "Couldn't load the Machine library.");
  const [makeId, setMakeId] = useState("");
  const [modelId, setModelId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [assetNumber, setAssetNumber] = useState("");
  const [site, setSite] = useState("");
  const [hours, setHours] = useState("");
  const [status, setStatus] = useState<OperatingStatus>("running");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const makes = catalog.data ?? [];
  const models = makes.find((make) => make.id === makeId)?.models ?? [];
  const isHoursValid = hours === "" || /^\d+$/.test(hours);
  const canSubmit = Boolean(modelId) && serialNumber.trim() !== "" && isHoursValid;

  const handleSubmit = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await registerMachineRequest(requireAccessToken(), {
        modelId,
        serialNumber: serialNumber.trim(),
        assetNumber: assetNumber.trim() || undefined,
        site: site.trim() || undefined,
        operatingHours: hours === "" ? undefined : Number(hours),
        status,
      });
      onRegistered();
      onClose();
    } catch (error) {
      setSaveError(toApiErrorMessage(error, "Couldn't add the machine. Please try again."));
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Add machine" onClose={isSaving ? undefined : onClose} widthClassName="w-[520px]">
      <div className="flex flex-col gap-3.5 p-5">
        {catalog.data && makes.length === 0 && (
          <p className="rounded-lg bg-amberTint p-3 text-sm text-amber">
            The Machine library has no models yet. Ask your QuipTech admin to add yours, then register the machine here.
          </p>
        )}
        {catalog.error && <p className="text-sm text-danger">{catalog.error}</p>}
        <div className="flex gap-2.5">
          <Field label="Make">
            <select
              className={selectClasses}
              value={makeId}
              disabled={makes.length === 0}
              onChange={(event) => {
                setMakeId(event.target.value);
                setModelId("");
              }}
            >
              <option value="">Choose a make</option>
              {makes.map((make) => (
                <option key={make.id} value={make.id}>
                  {make.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Model">
            <select
              className={selectClasses}
              value={modelId}
              disabled={!makeId}
              onChange={(event) => setModelId(event.target.value)}
            >
              <option value="">Choose a model</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.machineClass ? `${model.name} · ${model.machineClass}` : model.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex gap-2.5">
          <Field label="Serial number">
            <Input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} maxLength={100} />
          </Field>
          <Field label="Asset number">
            <Input
              value={assetNumber}
              onChange={(event) => setAssetNumber(event.target.value)}
              placeholder="e.g. HT-2201"
              maxLength={100}
            />
          </Field>
        </div>
        <div className="flex gap-2.5">
          <Field label="Site">
            <Input value={site} onChange={(event) => setSite(event.target.value)} placeholder="e.g. Pit 4" maxLength={100} />
          </Field>
          <Field label="Hours">
            <Input value={hours} onChange={(event) => setHours(event.target.value)} inputMode="numeric" placeholder="0" />
          </Field>
          <Field label="Status">
            <select className={selectClasses} value={status} onChange={(event) => setStatus(event.target.value as OperatingStatus)}>
              {OPERATING_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {!isHoursValid && <span className="text-xs text-danger">Hours must be a whole number.</span>}
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" className="ml-auto" onClick={handleSubmit} disabled={isSaving || !canSubmit}>
            <Icon name="plus" />
            {isSaving ? "Adding…" : "Add machine"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
