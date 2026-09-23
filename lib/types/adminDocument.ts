import type { IconName } from "@/components/icons/icon";
import type { Tone } from "@/components/ui/tone";

export type AdminDocumentState = "Live" | "Parsing" | "Draft" | "Failed";

export interface AdminDocument {
  id: string;
  icon: IconName;
  iconTone: Tone;
  title: string;
  type: string;
  indexedLabel: string;
  pages: string;
  state: AdminDocumentState;
}

export const documentStateTone: Record<AdminDocumentState, Tone> = {
  Live: "primary",
  Parsing: "default",
  Draft: "amber",
  Failed: "danger",
};
