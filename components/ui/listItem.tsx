import type { ReactNode } from "react";
import { Icon, type IconName } from "../icons/icon";
import { toneChipClasses, type Tone } from "./tone";

interface ListItemProps {
  icon: IconName;
  iconTone?: Tone;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}

export const ListItem = ({ icon, iconTone = "default", title, subtitle, trailing }: ListItemProps) => {
  return (
    <div className="flex items-center gap-3 border-b border-borderGray py-2.5 last:border-b-0">
      <span className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg ${toneChipClasses[iconTone]}`}>
        <Icon name={icon} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[15px] font-medium text-ink">{title}</span>
        {subtitle ? <span className="truncate text-xs text-mutedGray">{subtitle}</span> : null}
      </div>
      {trailing ? <div className="ml-auto flex flex-none items-center gap-2">{trailing}</div> : null}
    </div>
  );
};
