import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { machineAppPagePath } from "@/lib/types/machineAppConnection";
import { describeTablet, type McDevice } from "@/lib/types/machineControl";
import { OnlineStatus } from "../onlineStatus";

const SHOWN = 5;

// The first few connected machines, online first, each opening its Machine app tab.
export const ConnectedMachinesCard = ({ devices }: { devices: McDevice[] }) => (
  <section className="flex flex-col rounded-2xl border border-borderGray bg-surface">
    <div className="flex items-center border-b border-borderGray px-5 py-4">
      <h2 className="text-[17px] font-medium text-ink">Connected machines</h2>
      {devices.length > SHOWN && (
        <Link href="/machine-control/devices" className="ml-auto text-sm font-medium text-primaryHover hover:underline">
          View all {devices.length}
        </Link>
      )}
    </div>
    {devices.slice(0, SHOWN).map((device) => (
      <Link
        key={device.id}
        href={machineAppPagePath(device.machine.id)}
        className="group flex items-center gap-3 border-b border-borderGray px-5 py-3.5 last:border-b-0 hover:bg-surfaceGray"
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primaryTint text-primaryHover">
          <Icon name="truck" className="h-[18px] w-[18px]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-medium text-ink">{device.machine.label}</span>
          <span className="truncate text-xs text-mutedGray">
            {device.machine.manufacturer} {device.machine.model} · {describeTablet(device)}
          </span>
        </span>
        <OnlineStatus online={device.online} lastSeenAt={device.lastSeenAt} />
        <Icon name="chevr" className="h-4 w-4 stroke-mutedGray transition-transform group-hover:translate-x-0.5" />
      </Link>
    ))}
  </section>
);
