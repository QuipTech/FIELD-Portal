import type { CaseMessage } from "@/lib/types/caseMessage";

export const caseMessagesById: Record<string, CaseMessage[]> = {
  "1042": [
    {
      id: "1",
      authorInitials: "JO",
      authorName: "J. Okoye",
      roleLabel: "Reported",
      timestampLabel: "12 Mar · 08:14",
      body:
        "E-2204 on every cold start since the pump swap. Pre-charge reads 8.2 MPa against a 9.5 MPa minimum. Machine parked at Bench 3 pending parts.",
      photoCount: 2,
    },
    {
      id: "2",
      authorInitials: "TM",
      authorName: "T. Meyer",
      roleLabel: "Support",
      timestampLabel: "12 Mar · 09:02",
      body:
        "Bladder kit 1R-0762 was removed on 18 Mar and never refitted — see the configuration diff. Ordering a replacement, ETA tomorrow 10:00.",
    },
  ],
};
