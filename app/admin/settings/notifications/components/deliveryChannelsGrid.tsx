"use client";

import type { IconName } from "@/components/icons/icon";
import { IconTile } from "@/components/ui/iconTile";
import { Switch } from "@/components/ui/switch";
import type { AlertChannel, DeliveryChannels } from "@/lib/types/notificationSettings";

const channels: { id: AlertChannel; label: string; icon: IconName }[] = [
  { id: "push", label: "Push notifications", icon: "bell" },
  { id: "email", label: "Email", icon: "mail" },
  { id: "sms", label: "SMS (P1 only)", icon: "msg" },
];

interface DeliveryChannelsGridProps {
  values: DeliveryChannels;
  pendingChannel: AlertChannel | null;
  onToggle: (channel: AlertChannel, isOn: boolean) => void;
}

// Organisation-wide switches: a channel switched off here is off for
// every rule that uses it.
export const DeliveryChannelsGrid = ({ values, pendingChannel, onToggle }: DeliveryChannelsGridProps) => {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {channels.map((channel) => (
        <div key={channel.id} className="flex items-center rounded-xl border border-slate-200 bg-surface p-6 shadow-sm">
          <IconTile icon={channel.icon} />
          <span className="ml-4 flex-1 text-base font-medium text-slate-800">{channel.label}</span>
          <span className="ml-auto">
            <Switch
              on={values[channel.id]}
              onToggle={() => onToggle(channel.id, !values[channel.id])}
              disabled={pendingChannel === channel.id}
            />
          </span>
        </div>
      ))}
    </div>
  );
};
