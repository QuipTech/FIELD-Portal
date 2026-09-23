import type { IconName } from "@/components/icons/icon";
import type { Tone } from "@/components/ui/tone";

export interface IngestionQueueItem {
  id: string;
  icon: IconName;
  iconTone: Tone;
  title: string;
  caption: string;
  statusLabel: string;
  statusTone: Tone;
}

export interface AdminActionItem {
  id: string;
  icon: IconName;
  title: string;
  caption: string;
}
