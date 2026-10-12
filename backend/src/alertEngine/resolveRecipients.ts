import { AlertAudience } from '../organisationNotifications/alertTriggerCatalog';
import { RecipientCandidate } from './types/alertTypes';

// Who each audience is inside an organisation. There's no organisation
// admin, site supervisor or reviewer role yet, so they map to the closest
// existing roles (see the README).
const AUDIENCE_ROLES: Record<AlertAudience, string[]> = {
  admins: ['Customer', 'Owner'],
  site_supervisors: ['Technical Manager'],
  assigned_technician: [],
  ai_reviewers: ['Knowledge Manager'],
};

const isInAudience = (
  candidate: RecipientCandidate,
  audience: AlertAudience,
): boolean => {
  if (
    candidate.roleNames.some((role) => AUDIENCE_ROLES[audience].includes(role))
  )
    return true;
  if (audience === 'assigned_technician')
    return candidate.isCaseAssignee || candidate.hasWorkedOnMachine;
  if (audience === 'ai_reviewers') return candidate.hasReviewedAnswers;
  return false;
};

// The rule's audiences as people, each once. Anyone outside the rule's
// organisation is dropped here too, whatever the query returned.
export const resolveRecipients = (
  audiences: AlertAudience[],
  candidates: RecipientCandidate[],
  ruleTenantId: string,
): RecipientCandidate[] => {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (candidate.tenantId !== ruleTenantId || seen.has(candidate.userId))
      return false;
    if (!audiences.some((audience) => isInAudience(candidate, audience)))
      return false;
    seen.add(candidate.userId);
    return true;
  });
};
