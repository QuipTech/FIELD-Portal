import type { IconName } from "@/components/icons/icon";
import type { Tone } from "@/components/ui/tone";

export type HistoryEntryType = "Repair" | "Inspection" | "Fault" | "Service";

export interface HistoryEntry {
  id: string;
  type: HistoryEntryType;
  title: string;
  detail: string;
  authorLabel: string;
  hasPhotos?: boolean;
}

interface HistoryEntryTypeMeta {
  icon: IconName;
  tone: Tone;
}

export const historyEntryTypeMeta: Record<HistoryEntryType, HistoryEntryTypeMeta> = {
  Repair: { icon: "wrench", tone: "primary" },
  Inspection: { icon: "eye", tone: "default" },
  Fault: { icon: "alert", tone: "amber" },
  Service: { icon: "tool", tone: "default" },
};
