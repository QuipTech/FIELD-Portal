import type { HistoryEntry } from "@/lib/types/historyEntry";

export const historyEntries: HistoryEntry[] = [
  {
    id: "1",
    type: "Repair",
    title: "Main hydraulic pump replaced",
    detail:
      "Pump A seized on cold start; fitted Pump B (4T-9455), bled system, test cycle clean. 3.5 h downtime.",
    authorLabel: "12 Mar · J. Okoye",
    hasPhotos: true,
  },
  {
    id: "2",
    type: "Inspection",
    title: "250 h walkaround",
    detail: "Left final drive seal weeping — replaced. All other checks pass.",
    authorLabel: "04 Mar · A. Silva",
  },
  {
    id: "3",
    type: "Fault",
    title: "E-2204 · brake accumulator pre-charge low",
    detail: "Auto-captured from telemetry · cleared after recharge",
    authorLabel: "28 Feb · System",
  },
  {
    id: "4",
    type: "Service",
    title: "1,000 h service — engine & filters",
    detail: "Oil sample sent to lab; results attached.",
    authorLabel: "19 Feb · J. Okoye",
  },
];
