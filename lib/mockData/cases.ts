import type { SupportCase } from "@/lib/types/supportCase";

export const supportCases: SupportCase[] = [
  {
    id: "1042",
    subject: "Brake pressure alarm on cold start",
    icon: "alert",
    assetId: "HT-2201",
    assignee: { initials: "JO", name: "J. Okoye" },
    priority: "P1",
    updatedLabel: "24 min ago",
  },
  {
    id: "1039",
    subject: "Hydraulic leak returns after pump swap",
    icon: "life",
    assetId: "HT-2201",
    assignee: { initials: "AS", name: "A. Silva" },
    priority: "P2",
    updatedLabel: "2 h ago",
  },
  {
    id: "1036",
    subject: "Manual page missing for WA900 axle",
    icon: "book",
    assetId: "LD-0904",
    assignee: { initials: "RM", name: "R. Mbeki" },
    priority: "P3",
    updatedLabel: "Yesterday",
  },
  {
    id: "1031",
    subject: "AI answer contradicted Bulletin 88",
    icon: "spark",
    assetId: "—",
    assignee: { initials: "TM", name: "T. Meyer" },
    priority: "P2",
    updatedLabel: "2 days ago",
  },
  {
    id: "1028",
    subject: "Final drive seal weeping after 250 h check",
    icon: "wrench",
    assetId: "HT-2188",
    assignee: { initials: "JO", name: "J. Okoye" },
    priority: "P3",
    updatedLabel: "3 days ago",
  },
  {
    id: "1024",
    subject: "Torque converter oil sample flagged",
    icon: "alert",
    assetId: "HT-2188",
    assignee: { initials: "AS", name: "A. Silva" },
    priority: "P2",
    updatedLabel: "4 days ago",
  },
  {
    id: "1019",
    subject: "Export data download returns empty PDF",
    icon: "download",
    assetId: "—",
    assignee: { initials: "RM", name: "R. Mbeki" },
    priority: "P3",
    updatedLabel: "6 days ago",
  },
];

export const findCase = (id: string): SupportCase | undefined => {
  return supportCases.find((item) => item.id === id);
};
