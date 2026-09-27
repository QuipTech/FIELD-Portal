export const queriesPerDay = [58, 70, 64, 82, 76, 40, 38, 90, 74, 68, 44, 36];

export interface SiteUsage {
  site: string;
  percent: number;
  queries: string;
}

export const usageBySite: SiteUsage[] = [
  { site: "Pit 4", percent: 78, queries: "7,120" },
  { site: "Pit 2", percent: 56, queries: "5,110" },
  { site: "Bench 7", percent: 38, queries: "3,480" },
  { site: "Pit 1", percent: 27, queries: "2,530" },
];

export type ReviewQueueStatus = "Unreviewed" | "In review" | "Resolved" | "Escalated";

export interface ReviewQueueItem {
  id: string;
  question: string;
  flagged: boolean;
  reason: string;
  status: ReviewQueueStatus;
  reviewerInitials?: string;
  reviewerName?: string;
  flaggedLabel: string;
}

export const reviewQueue: ReviewQueueItem[] = [
  {
    id: "1",
    question: "“What torque for the upper suspension mount on a 2024 build?”",
    flagged: true,
    reason: "No source found",
    status: "Unreviewed",
    flaggedLabel: "19 Mar",
  },
  {
    id: "2",
    question: "“Can I run the pump dry for 30 seconds?”",
    flagged: true,
    reason: "Low confidence",
    status: "Unreviewed",
    flaggedLabel: "19 Mar",
  },
  {
    id: "3",
    question: "“Brake accumulator charge pressure for 793F”",
    flagged: false,
    reason: "Answer marked wrong",
    status: "In review",
    reviewerInitials: "AK",
    reviewerName: "A. Kaur",
    flaggedLabel: "18 Mar",
  },
  {
    id: "4",
    question: "“Which filter kit replaces 1R-0762?”",
    flagged: false,
    reason: "Low confidence",
    status: "Resolved",
    reviewerInitials: "TM",
    reviewerName: "T. Meyer",
    flaggedLabel: "17 Mar",
  },
  {
    id: "5",
    question: "“Bypass the park brake interlock to move the truck”",
    flagged: true,
    reason: "Safety refusal",
    status: "Escalated",
    reviewerInitials: "AK",
    reviewerName: "A. Kaur",
    flaggedLabel: "16 Mar",
  },
  {
    id: "6",
    question: "“Ride height spec after cylinder recharge”",
    flagged: false,
    reason: "No source found",
    status: "Resolved",
    reviewerInitials: "TM",
    reviewerName: "T. Meyer",
    flaggedLabel: "15 Mar",
  },
];
