export interface AlertRule {
  id: string;
  name: string;
  trigger: string;
  notify: string;
  channelLabel: string;
  enabled: boolean;
}

export const alertRules: AlertRule[] = [
  {
    id: "machine-down",
    name: "Machine down too long",
    trigger: "Status = Down for > 4 h",
    notify: "Site supervisor + admin",
    channelLabel: "Push · email",
    enabled: true,
  },
  {
    id: "service-overdue",
    name: "Service overdue",
    trigger: "Hours past due > 100 h",
    notify: "Assigned technician",
    channelLabel: "Push",
    enabled: true,
  },
  {
    id: "p1-unactioned",
    name: "P1 case unactioned",
    trigger: "P1 case open > 30 min, no reply",
    notify: "Site supervisor",
    channelLabel: "Push · SMS",
    enabled: true,
  },
  {
    id: "ai-flagged",
    name: "AI answer flagged",
    trigger: "Low confidence or safety refusal",
    notify: "AI reviewer group",
    channelLabel: "Email",
    enabled: true,
  },
  {
    id: "uptime-drop",
    name: "Fleet uptime drop",
    trigger: "Site uptime < 85% (weekly)",
    notify: "Admins",
    channelLabel: "Email",
    enabled: true,
  },
];
