import { Tag } from "@/components/ui/tag";
import type { ShareAccessLevel } from "@/lib/types/machineGroup";

const LABELS: Record<ShareAccessLevel, string> = { view: "View", contribute: "Contribute" };

// A share's level: "View" reads only; "Contribute" also adds history,
// photos and cases.
export const ShareAccessLevelTag = ({ level }: { level: ShareAccessLevel }) => (
  <Tag tone={level === "contribute" ? "primary" : "default"}>{LABELS[level]}</Tag>
);
