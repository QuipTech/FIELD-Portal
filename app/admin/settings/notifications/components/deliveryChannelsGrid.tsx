"use client";

import { useState } from "react";
import type { IconName } from "@/components/icons/icon";
import { IconTile } from "@/components/ui/iconTile";
import { Switch } from "@/components/ui/switch";

const channels: { id: string; label: string; icon: IconName }[] = [
  { id: "push", label: "Push notifications", icon: "bell" },
  { id: "email", label: "Email", icon: "mail" },
  { id: "sms", label: "SMS (P1 only)", icon: "msg" },
];

export const DeliveryChannelsGrid = () => {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ push: true, email: true, sms: true });

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {channels.map((channel) => (
        <div
          key={channel.id}
          className="flex items-center rounded-xl border border-slate-200 bg-surface p-6 shadow-sm"
        >
          <IconTile icon={channel.icon} />
          <span className="ml-4 flex-1 text-base font-medium text-slate-800">{channel.label}</span>
          <span className="ml-auto">
            <Switch
              on={enabled[channel.id]}
              onToggle={() => setEnabled((current) => ({ ...current, [channel.id]: !current[channel.id] }))}
            />
          </span>
        </div>
      ))}
    </div>
  );
};
