import type { CasePriority } from "@/lib/types/supportCase";
import type { Tone } from "@/components/ui/tone";

const priorityTone: Record<CasePriority, Tone> = {
  P1: "danger",
  P2: "amber",
  P3: "default",
};

export const getCasePriorityTone = (priority: CasePriority): Tone => priorityTone[priority];
