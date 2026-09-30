import type { IconName } from "@/components/icons/icon";
import type { Tone } from "@/components/ui/tone";
import type { CaseCategory, CasePriority, CaseStatus } from "../types/supportCase";

export const CASE_CATEGORIES: { value: CaseCategory; label: string; icon: IconName }[] = [
  { value: "alarm", label: "Alarm or fault code", icon: "alert" },
  { value: "leak", label: "Leak or failure", icon: "life" },
  { value: "wear", label: "Wear or inspection finding", icon: "wrench" },
  { value: "documentation", label: "Manual or documentation", icon: "book" },
  { value: "ai_answer", label: "AI assistant answer", icon: "spark" },
  { value: "data", label: "Data or export", icon: "download" },
  { value: "other", label: "Something else", icon: "msg" },
];

export const getCaseCategoryIcon = (category: CaseCategory): IconName =>
  CASE_CATEGORIES.find((option) => option.value === category)?.icon ?? "msg";

export const CASE_PRIORITIES: { value: CasePriority; label: string }[] = [
  { value: "P1", label: "P1 · Machine down" },
  { value: "P2", label: "P2 · Degraded" },
  { value: "P3", label: "P3 · Question" },
];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const CASE_STATUS_TONES: Record<CaseStatus, Tone> = {
  open: "amber",
  in_progress: "primary",
  resolved: "ok",
};

// "#1042"
export const formatCaseNumber = (caseNumber: number): string => `#${caseNumber}`;
