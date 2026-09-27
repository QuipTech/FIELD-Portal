import type { Tone } from "@/components/ui/tone";
import type { IconName } from "@/components/icons/icon";

export interface MachineComponentStatus {
  name: string;
  note: string;
  tag: string;
  tone: Extract<Tone, "ok" | "amber">;
  icon: IconName;
}
