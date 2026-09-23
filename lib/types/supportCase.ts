import type { IconName } from "@/components/icons/icon";

export type CasePriority = "P1" | "P2" | "P3";

export interface SupportCase {
  id: string;
  subject: string;
  icon: IconName;
  assetId: string;
  assignee: { initials: string; name: string };
  priority: CasePriority;
  updatedLabel: string;
}
