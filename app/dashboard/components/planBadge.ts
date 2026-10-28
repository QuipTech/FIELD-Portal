import type { OrganisationSubscription } from "@/lib/types/organisationSubscription";
import type { PersonalBillingStatus } from "@/lib/types/personalBilling";

export interface PlanBadge {
  label: string | null;
  showUpgrade: boolean;
}

// What the top bar shows about the user's plan. A non-Owner's own monthly
// FIELD Technician payment decides it: once paid there is nothing to
// upgrade. Owners keep their organisation's plan.
export const describePlanBadge = (
  personal: PersonalBillingStatus | null,
  organisation: OrganisationSubscription | null,
): PlanBadge => {
  // Wait for the personal status so a paid user never sees "Free plan" flash.
  if (!personal) return { label: null, showUpgrade: false };
  if (!personal.exempt && !personal.paymentRequired)
    return {
      label: personal.coveredByOrganisation ? "Technician · paid by organisation" : "Technician plan · Paid",
      showUpgrade: false,
    };
  return { label: organisation ? `${organisation.planName} plan` : null, showUpgrade: true };
};
