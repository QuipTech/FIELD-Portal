import { describe, expect, it } from "vitest";
import { describePlanBadge } from "./planBadge";
import type { OrganisationSubscription } from "@/lib/types/organisationSubscription";
import type { PersonalBillingStatus } from "@/lib/types/personalBilling";

const personal = (fields: Partial<PersonalBillingStatus>) => ({
  exempt: false, coveredByOrganisation: false, paymentRequired: true, ...fields,
}) as PersonalBillingStatus;
const freePlan = { planName: "Free" } as OrganisationSubscription;

describe("top bar plan badge", () => {
  it("shows the free plan and Upgrade until this month is paid", () => {
    expect(describePlanBadge(personal({}), freePlan)).toEqual({ label: "Free plan", showUpgrade: true });
  });

  it("shows the paid Technician plan and hides Upgrade once paid", () => {
    expect(describePlanBadge(personal({ paymentRequired: false }), freePlan))
      .toEqual({ label: "Technician plan · Paid", showUpgrade: false });
  });

  it("says when the organisation's seat covers the user", () => {
    expect(describePlanBadge(personal({ paymentRequired: false, coveredByOrganisation: true }), freePlan).label)
      .toBe("Technician · paid by organisation");
  });

  it("keeps the organisation plan for Owners", () => {
    expect(describePlanBadge(personal({ exempt: true, paymentRequired: false }), { planName: "Fleet" } as OrganisationSubscription))
      .toEqual({ label: "Fleet plan", showUpgrade: true });
  });

  it("shows nothing until the payment status has loaded", () => {
    expect(describePlanBadge(null, freePlan)).toEqual({ label: null, showUpgrade: false });
  });
});
