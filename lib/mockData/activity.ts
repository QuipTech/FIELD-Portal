import type { ActivityItem } from "@/lib/types/activity";

export const recentActivity: ActivityItem[] = [
  {
    id: "1",
    icon: "life",
    iconTone: "amber",
    title: "Case #1042 · Brake pressure alarm",
    caption: "HT-2201 · awaiting your reply · 24 min ago",
    tag: { label: "P1 open", tone: "amber" },
  },
  {
    id: "2",
    icon: "check",
    iconTone: "amber",
    title: "Entry pending supervisor sign-off",
    caption: "Hydraulic pump swap · submitted 1 h ago",
    tag: { label: "Pending", tone: "amber" },
  },
  {
    id: "3",
    icon: "wrench",
    iconTone: "default",
    title: "Repair logged on DZ-118",
    caption: "A. Silva · final drive seal · 3 h ago",
  },
  {
    id: "4",
    icon: "spark",
    iconTone: "default",
    title: "AI thread — fault E-2204",
    caption: "2 sources cited · yesterday 16:40",
  },
  {
    id: "5",
    icon: "book",
    iconTone: "default",
    title: "Bulletin 88 added to Knowledge",
    caption: "CAT 793F suspension recharge · yesterday",
  },
];
