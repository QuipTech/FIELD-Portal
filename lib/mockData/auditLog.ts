export interface AuditLogEntry {
  id: string;
  timeLabel: string;
  actorInitials: string;
  actorName: string;
  action: string;
  target: string;
  source: "Web admin" | "Mobile";
}

export const auditLogEntries: AuditLogEntry[] = [
  {
    id: "1",
    timeLabel: "19 Mar 09:14",
    actorInitials: "TM",
    actorName: "T. Meyer",
    action: "Invited user",
    target: "r.mbeki@quiptech.com · Technician",
    source: "Web admin",
  },
  {
    id: "2",
    timeLabel: "19 Mar 08:52",
    actorInitials: "JO",
    actorName: "J. Okoye",
    action: "Added history entry",
    target: "HT-2201 · Repair · pump replaced",
    source: "Mobile",
  },
  {
    id: "3",
    timeLabel: "18 Mar 17:30",
    actorInitials: "TM",
    actorName: "T. Meyer",
    action: "Changed role permission",
    target: "Supervisor · +Publish knowledge",
    source: "Web admin",
  },
  {
    id: "4",
    timeLabel: "18 Mar 14:20",
    actorInitials: "JO",
    actorName: "J. Okoye",
    action: "Took config snapshot",
    target: "HT-2201 · manual trigger",
    source: "Mobile",
  },
  {
    id: "5",
    timeLabel: "17 Mar 11:06",
    actorInitials: "AK",
    actorName: "A. Kaur",
    action: "Published prompt v3",
    target: "AI configuration · from v2",
    source: "Web admin",
  },
  {
    id: "6",
    timeLabel: "16 Mar 15:41",
    actorInitials: "AK",
    actorName: "A. Kaur",
    action: "Escalated flagged answer",
    target: "Review queue · safety refusal",
    source: "Web admin",
  },
  {
    id: "7",
    timeLabel: "15 Mar 10:12",
    actorInitials: "AK",
    actorName: "A. Kaur",
    action: "Added machine model",
    target: "Hitachi EX3600 · 7 systems",
    source: "Web admin",
  },
  {
    id: "8",
    timeLabel: "14 Mar 16:02",
    actorInitials: "TM",
    actorName: "T. Meyer",
    action: "Uploaded document",
    target: "Bulletin 88 — revised charge pressure",
    source: "Web admin",
  },
];
