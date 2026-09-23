import type { IngestionQueueItem, AdminActionItem } from "@/lib/types/adminOverview";

export const ingestionQueue: IngestionQueueItem[] = [
  {
    id: "1",
    icon: "file",
    iconTone: "default",
    title: "CAT 793F service manual — vol 2",
    caption: "412 pages · 68% parsed",
    statusLabel: "Parsing",
    statusTone: "default",
  },
  {
    id: "2",
    icon: "file",
    iconTone: "default",
    title: "Komatsu WA900 parts book",
    caption: "Queued behind 2 jobs",
    statusLabel: "Queued",
    statusTone: "default",
  },
  {
    id: "3",
    icon: "alert",
    iconTone: "danger",
    title: "Sandvik DR410 wiring diagrams",
    caption: "Scanned pages unreadable — needs OCR",
    statusLabel: "Failed",
    statusTone: "danger",
  },
  {
    id: "4",
    icon: "eye",
    iconTone: "amber",
    title: "Bulletin 88 — awaiting review",
    caption: "Uploaded by T. Meyer · 14 Mar",
    statusLabel: "Pending",
    statusTone: "amber",
  },
];

export const latestAdminActions: AdminActionItem[] = [
  { id: "1", icon: "users", title: "Invited 3 technicians", caption: "T. Meyer · 09:14" },
  {
    id: "2",
    icon: "shield",
    title: "Supervisor role gained “Publish knowledge”",
    caption: "T. Meyer · yesterday",
  },
  { id: "3", icon: "sliders", title: "Prompt v3 published", caption: "A. Kaur · 17 Mar" },
  { id: "4", icon: "db", title: "Added model Hitachi EX3600", caption: "A. Kaur · 15 Mar" },
];
