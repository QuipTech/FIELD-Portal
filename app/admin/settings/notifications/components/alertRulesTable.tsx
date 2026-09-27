"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { alertRules, type AlertRule } from "@/lib/mockData/notificationRules";

export const AlertRulesTable = () => {
  const [rules, setRules] = useState<AlertRule[]>(alertRules);

  const toggleRule = (id: string) => {
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-surface">
      <div className="flex gap-4 bg-slate-50/50 px-4 py-3">
        <span className="min-w-0 flex-[2] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Rule
        </span>
        <span className="min-w-0 flex-[2.2] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Trigger
        </span>
        <span className="min-w-0 flex-[1.6] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Notify
        </span>
        <span className="min-w-0 flex-[1.2] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Channel
        </span>
        <span className="w-10 flex-none text-[11px] font-semibold uppercase tracking-wider text-slate-400">On</span>
      </div>
      {rules.map((rule) => (
        <div key={rule.id} className="flex items-center gap-4 border-t border-slate-200/80 px-4 py-3.5">
          <span className="min-w-0 flex-[2] text-sm font-medium text-slate-800">{rule.name}</span>
          <span className="min-w-0 flex-[2.2] text-sm text-slate-500">{rule.trigger}</span>
          <span className="min-w-0 flex-[1.6] text-sm text-slate-500">{rule.notify}</span>
          <span className="min-w-0 flex-[1.2]">
            <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              {rule.channelLabel}
            </span>
          </span>
          <span className="w-10 flex-none">
            <Switch on={rule.enabled} onToggle={() => toggleRule(rule.id)} />
          </span>
        </div>
      ))}
    </div>
  );
};
