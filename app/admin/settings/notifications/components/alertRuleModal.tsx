"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { AlertRule, AlertRulePayload, NotificationOptions, TriggerParams } from "@/lib/types/notificationSettings";
import { TriggerParamInputs } from "./triggerParamInputs";

interface AlertRuleModalProps {
  options: NotificationOptions;
  // Omit to create a new rule.
  rule?: AlertRule;
  onSave: (payload: AlertRulePayload, ruleId?: string) => Promise<void>;
  onClose: () => void;
}

const labelClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";
const selectClasses = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink";

const defaultsFor = (options: NotificationOptions, triggerType: string): TriggerParams =>
  Object.fromEntries(
    (options.triggerTypes.find((type) => type.type === triggerType)?.fields ?? []).map((field) => [
      field.key,
      field.default,
    ]),
  );

const DEFAULT_COOLDOWN_MINUTES = 240;
const MAX_COOLDOWN_HOURS = 168;

const toggle = <T,>(values: T[], value: T, isOn: boolean) =>
  isOn ? [...values, value] : values.filter((item) => item !== value);

export const AlertRuleModal = ({ options, rule, onSave, onClose }: AlertRuleModalProps) => {
  const firstType = options.triggerTypes[0];
  const [form, setForm] = useState<AlertRulePayload>(
    () =>
      rule ?? {
        name: firstType.label,
        triggerType: firstType.type,
        triggerParams: defaultsFor(options, firstType.type),
        audiences: ["admins"],
        channels: ["email"],
        isEnabled: true,
        cooldownMinutes: DEFAULT_COOLDOWN_MINUTES,
      },
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const triggerType = options.triggerTypes.find((type) => type.type === form.triggerType) ?? firstType;
  const update = (change: Partial<AlertRulePayload>) => setForm((current) => ({ ...current, ...change }));

  const changeTriggerType = (type: string) => {
    const label = options.triggerTypes.find((item) => item.type === type)?.label ?? "";
    // A name still matching the old trigger's label follows the new one.
    const name = form.name === triggerType.label ? label : form.name;
    update({ triggerType: type, triggerParams: defaultsFor(options, type), name });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      const { name, triggerType: type, triggerParams, audiences, channels, isEnabled, cooldownMinutes } = form;
      await onSave(
        { name: name.trim(), triggerType: type, triggerParams, audiences, channels, isEnabled, cooldownMinutes },
        rule?.id,
      );
      onClose();
    } catch (error) {
      setSaveError(toApiErrorMessage(error, "Couldn't save the rule. Please try again."));
      setIsSaving(false);
    }
  };

  return (
    <Modal
      title={rule ? "Edit alert rule" : "New alert rule"}
      onClose={isSaving ? undefined : onClose}
      widthClassName="w-[520px]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5">
          <span className={labelClasses}>Trigger</span>
          <select
            value={form.triggerType}
            onChange={(event) => changeTriggerType(event.target.value)}
            className={selectClasses}
          >
            {options.triggerTypes.map((type) => (
              <option key={type.type} value={type.type}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <TriggerParamInputs
          fields={triggerType.fields}
          values={form.triggerParams}
          onChange={(key, value) => update({ triggerParams: { ...form.triggerParams, [key]: value } })}
        />
        <label className="flex flex-col gap-1.5">
          <span className={labelClasses}>Rule name</span>
          <Input
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
            maxLength={120}
            required
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className={labelClasses}>Notify</span>
          <div className="flex flex-wrap gap-3">
            {options.audiences.map((audience) => (
              <label key={audience.value} className="flex items-center gap-1.5 text-sm text-bodyGray">
                <input
                  type="checkbox"
                  checked={form.audiences.includes(audience.value)}
                  onChange={(event) =>
                    update({ audiences: toggle(form.audiences, audience.value, event.target.checked) })
                  }
                />
                {audience.label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={labelClasses}>Channels</span>
          <div className="flex flex-wrap gap-3">
            {options.channels.map((channel) => (
              <label key={channel.value} className="flex items-center gap-1.5 text-sm text-bodyGray">
                <input
                  type="checkbox"
                  checked={form.channels.includes(channel.value)}
                  onChange={(event) => update({ channels: toggle(form.channels, channel.value, event.target.checked) })}
                />
                {channel.label}
              </label>
            ))}
          </div>
          <span className="text-xs text-mutedGray">SMS is only for P1 case rules.</span>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelClasses}>Don&apos;t repeat for (hours)</span>
          <Input
            type="number"
            min={0}
            max={MAX_COOLDOWN_HOURS}
            step={0.5}
            value={form.cooldownMinutes / 60}
            onChange={(event) => update({ cooldownMinutes: Math.round(Number(event.target.value) * 60) })}
          />
          <span className="text-xs text-mutedGray">
            The same person isn&apos;t alerted again about the same machine or case within this time.
          </span>
        </label>
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="ml-auto"
            disabled={isSaving || !form.name.trim() || !form.audiences.length || !form.channels.length}
          >
            {isSaving ? "Saving…" : "Save rule"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
