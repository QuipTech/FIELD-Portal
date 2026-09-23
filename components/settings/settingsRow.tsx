import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons/icon";
import { toneChipClasses, type Tone } from "@/components/ui/tone";

interface SettingsRowProps {
  icon: IconName;
  tone?: Tone;
  title: string;
  caption: string;
  trailing?: ReactNode;
  bordered?: boolean;
}

export const SettingsRow = ({ icon, tone = "default", title, caption, trailing, bordered = true }: SettingsRowProps) => {
  return (
    <div className={`flex items-center gap-2.5 p-4 ${bordered ? "border-b border-borderGray" : ""}`}>
      <span className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg ${toneChipClasses[tone]}`}>
        <Icon name={icon} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-medium text-ink">{title}</span>
        <span className="text-xs text-mutedGray">{caption}</span>
      </div>
      {trailing ? <div className="ml-auto flex flex-none items-center gap-2">{trailing}</div> : null}
    </div>
  );
};
