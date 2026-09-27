import type { AssistantThread, ChatMessage } from "@/lib/types/chatMessage";

export const assistantThreads: AssistantThread[] = [
  { id: "brake-pressure-alarm", title: "Brake pressure alarm" },
  { id: "hydraulic-leak-pump", title: "Hydraulic leak at pump" },
  { id: "fault-e2204", title: "Fault E-2204" },
  { id: "torque-upper-mount", title: "Torque spec — upper mount" },
];

export const activeThreadMessages: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    paragraphs: [
      "HT-2201 is throwing E-2204 on cold start. Brake accumulator pre-charge reads 8.2 MPa. What should I check first?",
    ],
  },
  {
    id: "2",
    role: "assistant",
    paragraphs: [
      "Pre-charge of 8.2 MPa is below the 9.5–10.5 MPa cold window for this weight class, so the alarm is genuine rather than a sensor fault. Check in this order:",
      "1 · Nitrogen charge at the accumulator — recharge and hold for 15 minutes. 2 · If it bleeds down, replace the bladder (P/N 1R-0762 was removed from this machine on 18 Mar). 3 · Only then suspect the pressure switch.",
    ],
    sources: [
      { label: "1 · Manual p. 214", icon: "book" },
      { label: "2 · Bulletin 88", icon: "alert" },
    ],
    actions: [
      { label: "Open source", icon: "ext" },
      { label: "Log as entry", icon: "file", permission: "history.create" },
      { label: "Raise case", icon: "life", permission: "support.create" },
    ],
  },
  {
    id: "3",
    role: "user",
    paragraphs: ["Charge held. What torque on the upper mount?"],
  },
];
