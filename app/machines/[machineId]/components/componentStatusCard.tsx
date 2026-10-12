import { Icon, type IconName } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import type { Tone } from "@/components/ui/tone";
import type { ComponentCondition, MachineComponent } from "@/lib/types/machineComponent";

const conditionMeta: Record<ComponentCondition, { label: string; tone: Tone; icon: IconName }> = {
  ok: { label: "OK", tone: "ok", icon: "check" },
  worn: { label: "Worn", tone: "amber", icon: "alert" },
  service_due: { label: "Service due", tone: "amber", icon: "clock" },
  fault: { label: "Fault", tone: "danger", icon: "alert" },
};

export const ComponentStatusCard = ({ component }: { component: MachineComponent }) => {
  const meta = component.condition ? conditionMeta[component.condition] : null;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-borderGray bg-surface p-3.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-[15px] font-medium text-ink">{component.name}</span>
        {meta && (
          <Tag tone={meta.tone} className="ml-auto">
            <Icon name={meta.icon} className="h-3.5 w-3.5" />
            {meta.label}
          </Tag>
        )}
      </div>
      <span className="text-xs text-mutedGray">{component.caption}</span>
    </div>
  );
};
