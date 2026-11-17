import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Table, TableCell, TableHeaderCell, TableHeaderRow, TableRow } from "@/components/ui/table";
import { formatShortDate } from "@/lib/format/shortDate";
import { machineAppPagePath } from "@/lib/types/machineAppConnection";
import { describeTablet, type McDevice } from "@/lib/types/machineControl";
import { OnlineStatus } from "./onlineStatus";

// Every connected tablet; a row opens the machine's Machine app tab. Scrolls
// inside its own box on narrow screens.
export const DevicesTable = ({ devices }: { devices: McDevice[] }) => (
  <div className="overflow-x-auto">
    <Table className="min-w-[820px]">
      <TableHeaderRow>
        <TableHeaderCell flex={2}>Machine</TableHeaderCell>
        <TableHeaderCell flex={1}>Site</TableHeaderCell>
        <TableHeaderCell flex={2}>Tablet</TableHeaderCell>
        <TableHeaderCell flex={1.6}>Status</TableHeaderCell>
        <TableHeaderCell flex={1.1}>Paired</TableHeaderCell>
        <TableHeaderCell flex={0.4}>
          <span className="sr-only">Open</span>
        </TableHeaderCell>
      </TableHeaderRow>
      {devices.map((device) => (
        <Link key={device.id} href={machineAppPagePath(device.machine.id)} className="group">
          <TableRow className="group-hover:bg-surfaceGray">
            <TableCell flex={2}>
              <div className="font-medium">{device.machine.label}</div>
              <div className="truncate text-xs text-mutedGray">
                {device.machine.manufacturer} {device.machine.model}
              </div>
            </TableCell>
            <TableCell flex={1} className="text-bodyGray">{device.machine.site ?? "—"}</TableCell>
            <TableCell flex={2} className="text-[13px] text-bodyGray">{describeTablet(device)}</TableCell>
            <TableCell flex={1.6}>
              <OnlineStatus online={device.online} lastSeenAt={device.lastSeenAt} />
            </TableCell>
            <TableCell flex={1.1} className="text-[13px] text-bodyGray">{formatShortDate(device.pairedAt)}</TableCell>
            <TableCell flex={0.4} className="flex justify-end">
              <Icon name="chevr" className="h-4 w-4 stroke-mutedGray transition-transform group-hover:translate-x-0.5" />
            </TableCell>
          </TableRow>
        </Link>
      ))}
    </Table>
  </div>
);
