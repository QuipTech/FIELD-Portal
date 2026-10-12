import type { CaseEvent } from "../types/caseMessage";
import type { CaseStatus } from "../types/supportCase";
import { CASE_STATUS_LABELS } from "./caseLabels";
import { abbreviateName } from "./nameInitials";

const SYSTEM_ACTOR = "FIELD";
const FORMER_USER = "a former user";

const statusLabel = (value: string | null) =>
  value ? (CASE_STATUS_LABELS[value as CaseStatus] ?? value) : "";

// One sentence per thread event, e.g. "A. Kaur assigned the case to T. Meyer".
export const describeCaseEvent = (event: CaseEvent): string => {
  const actor = event.actor ? abbreviateName(event.actor.name) : SYSTEM_ACTOR;
  switch (event.type) {
    case "created":
      return `${actor} raised the case`;
    case "assigned":
      return `${actor} assigned the case to ${event.toPerson ? abbreviateName(event.toPerson.name) : FORMER_USER}`;
    case "unassigned":
      return `${actor} unassigned ${event.fromPerson ? abbreviateName(event.fromPerson.name) : FORMER_USER}`;
    case "status_changed":
      return `${actor} changed the status to ${statusLabel(event.toValue)}`;
    case "priority_changed":
      return `${actor} changed the priority from ${event.fromValue} to ${event.toValue}`;
    case "reopened":
      return `${actor} reopened the case`;
  }
};
