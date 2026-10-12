"use client";

import { Switch } from "@/components/ui/switch";
import { ActionMenu } from "@/components/ui/actionMenu";
import type { AlertRule } from "@/lib/types/notificationSettings";

interface AlertRulesTableProps {
  rules: AlertRule[];
  pendingRuleId: string | null;
  onToggle: (rule: AlertRule) => void;
  onEdit: (rule: AlertRule) => void;
  onSendTest: (rule: AlertRule) => void;
  onDelete: (rule: AlertRule) => void;
}

const headerClasses = "min-w-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400";

export const AlertRulesTable = ({ rules, pendingRuleId, onToggle, onEdit, onSendTest, onDelete }: AlertRulesTableProps) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-surface">
      <div className="flex gap-4 bg-slate-50/50 px-4 py-3">
        <span className={`${headerClasses} flex-[2]`}>Rule</span>
        <span className={`${headerClasses} flex-[2.2]`}>Trigger</span>
        <span className={`${headerClasses} flex-[1.6]`}>Notify</span>
        <span className={`${headerClasses} flex-[1.2]`}>Channel</span>
        <span className={`${headerClasses} w-[84px] flex-none`}>On</span>
      </div>
      {rules.length === 0 && (
        <div className="border-t border-slate-200/80 px-4 py-6 text-sm text-slate-500">
          No alert rules. Add one with New rule.
        </div>
      )}
      {rules.map((rule) => (
        <div key={rule.id} className="flex items-center gap-4 border-t border-slate-200/80 px-4 py-3.5">
          <span className="min-w-0 flex-[2] truncate text-sm font-medium text-slate-800">{rule.name}</span>
          <span className="min-w-0 flex-[2.2] text-sm text-slate-500">{rule.triggerLabel}</span>
          <span className="min-w-0 flex-[1.6] text-sm text-slate-500">{rule.notifyLabel}</span>
          <span className="min-w-0 flex-[1.2]">
            <span
              title={
                rule.disabledChannels.length ? `Switched off below: ${rule.disabledChannels.join(", ")}` : undefined
              }
              className={`inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs ${rule.disabledChannels.length ? "text-slate-400 line-through" : "text-slate-600"}`}
            >
              {rule.channelLabel}
            </span>
          </span>
          <span className="flex w-[84px] flex-none items-center gap-1">
            <Switch on={rule.isEnabled} onToggle={() => onToggle(rule)} disabled={pendingRuleId === rule.id} />
            <ActionMenu
              label={rule.name}
              items={[
                { label: "Edit", icon: "sliders", onSelect: () => onEdit(rule) },
                { label: "Send test", icon: "bell", onSelect: () => onSendTest(rule) },
                { label: "Delete", icon: "x", tone: "danger", onSelect: () => onDelete(rule) },
              ]}
            />
          </span>
        </div>
      ))}
    </div>
  );
};
