import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ListItem } from "@/components/ui/listItem";
import { Tag } from "@/components/ui/tag";
import { machines } from "@/lib/mockData/machines";
import { getMachineStatusMeta } from "@/lib/format/machineStatus";

export const MyMachinesCard = () => {
  const assigned = machines.slice(0, 4);

  return (
    <Card className="flex-1 gap-0.5">
      <div className="mb-1.5 flex items-baseline">
        <h2 className="text-base font-medium text-ink">My machines</h2>
        <span className="ml-auto text-xs text-mutedGray">{assigned.length} assigned</span>
      </div>
      {assigned.map((machine) => {
        const status = getMachineStatusMeta(machine.status);
        return (
          <Link key={machine.id} href={`/machines/${machine.id}`}>
            <ListItem
              icon="truck"
              iconTone={status.tone === "ok" ? "default" : status.tone}
              title={machine.id}
              subtitle={`${machine.model} · ${machine.site}`}
              trailing={<Tag tone={status.tone}>{status.label}</Tag>}
            />
          </Link>
        );
      })}
    </Card>
  );
};
