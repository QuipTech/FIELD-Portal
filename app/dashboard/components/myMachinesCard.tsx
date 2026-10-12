import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ListItem } from "@/components/ui/listItem";
import { Tag } from "@/components/ui/tag";
import { getMachineStatusMeta, toMachineStatus } from "@/lib/format/machineStatus";
import type { FleetMachine } from "@/lib/types/machineFleet";

// Machines the user has registered, logged work on, raised cases for or
// asked the assistant about.
export const MyMachinesCard = ({ machines }: { machines: FleetMachine[] }) => {
  return (
    <Card className="flex-1 gap-0.5">
      <div className="mb-1.5 flex items-baseline">
        <h2 className="text-base font-medium text-ink">My machines</h2>
        <span className="ml-auto text-xs text-mutedGray">{machines.length} recent</span>
      </div>
      {machines.length === 0 && (
        <span className="py-6 text-center text-sm text-mutedGray">Machines you log work on will appear here.</span>
      )}
      {machines.map((machine) => {
        const status = getMachineStatusMeta(toMachineStatus(machine.status));
        return (
          <Link key={machine.id} href={`/machines/${machine.id}/history`} className="rounded-lg hover:bg-fillGray/60">
            <ListItem
              icon="truck"
              iconTone={status.tone === "ok" ? "default" : status.tone}
              title={machine.label}
              subtitle={[`${machine.manufacturer} ${machine.model}`, machine.site].filter(Boolean).join(" · ")}
              trailing={<Tag tone={status.tone}>{status.label}</Tag>}
            />
          </Link>
        );
      })}
    </Card>
  );
};
