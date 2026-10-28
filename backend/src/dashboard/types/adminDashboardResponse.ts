import { MachinesDownSummary } from './dashboardResponse';

// GET /dashboard/admin
export interface AdminDashboard {
  machinesDown: MachinesDownSummary;
  // Open cases whose SLA is breached or due soon (the same rule as a
  // case's sla.state), the soonest few listed.
  casesNearSlaBreach: {
    total: number;
    breached: number;
    cases: {
      caseNumber: number;
      subject: string;
      priority: string;
      slaDueAt: string;
      slaState: 'breached' | 'due_soon';
    }[];
  };
  // Flagged AI answers in the organisation not yet resolved or escalated.
  aiAnswersToReview: { total: number };
  // Bulletins waiting for approval (own organisation and shared library).
  bulletinsToApprove: {
    total: number;
    documents: { id: string; title: string }[];
  };
}
