import { AlertMatch } from '../types/alertTypes';

// Fired by the AI assistant when an answer goes to the review queue.
export interface AnswerFlaggedEvent {
  tenantId: string;
  reviewItemId: string;
  reasonCode: string;
  reason: string;
  question: string;
}

const MAX_QUESTION_LENGTH = 140;

// "AI answer flagged": one match per flagged answer, for rules whose
// reasons include this one.
export const toAnswerFlaggedMatch = (
  event: AnswerFlaggedEvent,
): AlertMatch => ({
  entityKey: `review:${event.reviewItemId}`,
  title: `AI answer flagged: ${event.reason}`,
  body: event.question.slice(0, MAX_QUESTION_LENGTH),
  link: '/admin/ai-configuration',
  machineId: null,
  caseId: null,
});

export const ruleWatchesReason = (
  reasons: unknown,
  reasonCode: string,
): boolean => Array.isArray(reasons) && reasons.includes(reasonCode);
