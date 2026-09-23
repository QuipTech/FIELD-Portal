import type { IconName } from "@/components/icons/icon";
import type { Tone } from "@/components/ui/tone";

export interface ActivityItem {
  id: string;
  icon: IconName;
  iconTone: Tone;
  title: string;
  caption: string;
  tag?: { label: string; tone: Tone };
}
