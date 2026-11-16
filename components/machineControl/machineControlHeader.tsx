import { Icon } from "@/components/icons/icon";
import { ConnectMachineButton } from "./connectMachineButton";

interface MachineControlHeaderProps {
  // Null while the tablets load.
  onlineCount: number | null;
  connectedCount: number | null;
}

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/15">{children}</span>
);

// The module's banner: what it's for, how many tablets are live, and the one
// action everyone starts with. Deep brand colours, the same in both themes.
export const MachineControlHeader = ({ onlineCount, connectedCount }: MachineControlHeaderProps) => (
  <section className="relative flex flex-wrap items-center gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brandDeep via-[#2E2670] to-[#1B1640] p-6 text-white">
    <span aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10" />
    <span aria-hidden className="pointer-events-none absolute -right-4 -top-12 h-48 w-48 rounded-full border border-white/10" />
    <span aria-hidden className="pointer-events-none absolute right-16 top-6 h-24 w-24 rounded-full bg-white/5 blur-2xl" />
    <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
      <Icon name="broadcast" className="h-7 w-7 stroke-white" />
    </span>
    <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">
      <h1 className="text-[22px] font-medium leading-tight">Machine Control</h1>
      <p className="max-w-xl text-sm text-white/75">Send design files to the tablets on your machines and watch them arrive. Start by connecting a machine&apos;s tablet.</p>
      {connectedCount !== null && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          <Chip>
            <span className={`h-2 w-2 rounded-full ${onlineCount ? "bg-emerald-400" : "bg-white/40"}`} />
            {onlineCount} online
          </Chip>
          <Chip>
            {connectedCount} {connectedCount === 1 ? "machine" : "machines"} connected
          </Chip>
        </div>
      )}
    </div>
    <ConnectMachineButton variant="default" className="relative" />
  </section>
);
