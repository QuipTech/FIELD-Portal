import type { Tone } from "@/components/ui/tone";
import type { DemoRequest, DemoRequestStatus } from "@/lib/types/demoRequest";

export const STATUS_OPTIONS: { value: DemoRequestStatus; label: string; tone: Tone }[] = [
  { value: "new", label: "New", tone: "primary" },
  { value: "contacted", label: "Contacted", tone: "amber" },
  { value: "scheduled", label: "Scheduled", tone: "amber" },
  { value: "completed", label: "Demo done", tone: "default" },
  { value: "converted", label: "Converted", tone: "ok" },
  { value: "lost", label: "Lost", tone: "danger" },
];

export const getStatusOption = (status: DemoRequestStatus) =>
  STATUS_OPTIONS.find((option) => option.value === status) ?? STATUS_OPTIONS[0];

export const fullName = (request: DemoRequest) => `${request.firstName} ${request.lastName}`;

// Opens the Owner's mail app addressed to the requester.
export const replyMailtoHref = (request: DemoRequest) =>
  `mailto:${encodeURIComponent(request.email)}?subject=${encodeURIComponent(
    `Your QuipTech FIELD demo request — ${request.company}`,
  )}&body=${encodeURIComponent(`Hi ${request.firstName},\n\n`)}`;
