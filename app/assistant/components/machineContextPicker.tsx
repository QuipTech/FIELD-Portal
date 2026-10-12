import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { toneTagClasses } from "@/components/ui/tone";
import type { FleetMachine } from "@/lib/types/machineFleet";
import type { AssistantMachine } from "@/lib/types/aiAssistant";

interface MachineContextPickerProps {
  // Set for an existing thread, whose context can't change.
  fixedMachine: AssistantMachine | null;
  isThreadOpen: boolean;
  machines: FleetMachine[];
  value: string;
  onChange: (machineId: string) => void;
}

// The machine a thread is about: its details and service history go to
// the assistant with every question. Chosen when a thread starts.
export const MachineContextPicker = ({ fixedMachine, isThreadOpen, machines, value, onChange }: MachineContextPickerProps) => {
  if (isThreadOpen) {
    return (
      <Tag tone="primary">
        <Icon name="truck" className="h-3.5 w-3.5" />
        Context: {fixedMachine?.label ?? "None"}
      </Tag>
    );
  }
  return (
    <label className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs ${toneTagClasses.primary}`}>
      <Icon name="truck" className="h-3.5 w-3.5" />
      Context:
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Machine context for the new thread"
        className="max-w-[180px] cursor-pointer bg-transparent font-medium outline-none"
      >
        <option value="">No machine</option>
        {machines.map((machine) => (
          <option key={machine.id} value={machine.id}>
            {machine.label} · {machine.model}
          </option>
        ))}
      </select>
    </label>
  );
};
