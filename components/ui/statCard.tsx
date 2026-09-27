import { Icon, type IconName } from "../icons/icon";
import { toneCardClasses, type Tone } from "./tone";

interface StatCardProps {
  label: string;
  value: string;
  caption: string;
  icon: IconName;
  tone: Extract<Tone, "amber" | "danger" | "primary" | "default">;
}

const valueColorClasses: Record<StatCardProps["tone"], string> = {
  amber: "text-amber",
  danger: "text-danger",
  primary: "text-primaryHover",
  default: "text-ink",
};

const iconColorClasses: Record<StatCardProps["tone"], string> = {
  amber: "bg-amberTint text-amber",
  danger: "bg-dangerTint text-danger",
  primary: "bg-primaryTint text-primaryHover",
  default: "bg-fillGray text-bodyGray",
};

export const StatCard = ({ label, value, caption, icon, tone }: StatCardProps) => {
  return (
    <div className={`flex flex-1 flex-col gap-2 rounded-2xl border p-5 ${toneCardClasses[tone]}`}>
      <div className="flex items-center">
        <span className="text-[15px] text-bodyGray">{label}</span>
        <span className={`ml-auto flex h-[30px] w-[30px] items-center justify-center rounded-lg ${iconColorClasses[tone]}`}>
          <Icon name={icon} className="h-[14px] w-[14px]" />
        </span>
      </div>
      <div className={`text-[26px] font-medium leading-none ${valueColorClasses[tone]}`}>{value}</div>
      <span className="text-xs text-mutedGray">{caption}</span>
    </div>
  );
};
