"use client";

import {
  scheduleOnboardingRequest,
  setUpEnterpriseRequest,
  suspendAccountRequest,
  unsuspendAccountRequest,
} from "@/lib/api/adminBillingOperationsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import type { OrganisationBilling } from "@/lib/types/billingAccount";
import { AdminPromptDialog } from "./adminPromptDialog";
import type { BillingAccountAction } from "./billingAccountsTable";

interface BillingAccountActionsProps {
  organisation: OrganisationBilling;
  action: BillingAccountAction;
  onDone: (message: string) => void;
  onClose: () => void;
}

// The dialog for one billing account action from the accounts table.
export const BillingAccountActions = ({ organisation, action, onDone, onClose }: BillingAccountActionsProps) => {
  const accountId = organisation.billingAccount!.id;
  const name = organisation.organisationName;
  const token = () => requireAccessToken();

  if (action === "suspend")
    return (
      <AdminPromptDialog
        title={`Suspend ${name}`}
        description="Pauses new machine activations and new AI sessions until overdue invoices are paid. Nothing in progress stops, and reading and export stay available. Allowed 14 days after the first overdue notice."
        confirmLabel="Suspend account"
        confirmVariant="danger"
        fields={[{ name: "reason", label: "Reason (audit log)" }]}
        onConfirm={async ({ reason }) => {
          await suspendAccountRequest(token(), accountId, String(reason));
          onDone(`${name} suspended.`);
        }}
        onClose={onClose}
      />
    );
  if (action === "unsuspend")
    return (
      <AdminPromptDialog
        title={`Lift suspension for ${name}`}
        description="Activations and new AI sessions become available again."
        confirmLabel="Lift suspension"
        fields={[{ name: "reason", label: "Reason (audit log)", placeholder: "e.g. Overdue invoices paid" }]}
        onConfirm={async ({ reason }) => {
          await unsuspendAccountRequest(token(), accountId, String(reason));
          onDone(`${name} is active again.`);
        }}
        onClose={onClose}
      />
    );
  if (action === "enterprise")
    return (
      <AdminPromptDialog
        title={`Enterprise contract for ${name}`}
        description="Starts a quoted annual Enterprise contract today (minimum A$5,000 a year) and ends the self-serve plan. Invoice the contract from the Invoices tab."
        confirmLabel="Set up contract"
        fields={[
          { name: "annualQuote", label: "Annual contract value (A$, ex GST)", type: "money" },
          { name: "committedMachines", label: "Machines covered", type: "number" },
          { name: "reason", label: "Reason (audit log)", placeholder: "e.g. Signed quote Q-1234" },
        ]}
        onConfirm={async ({ annualQuote, committedMachines, reason }) => {
          await setUpEnterpriseRequest(token(), accountId, {
            annualQuoteCents: Number(annualQuote),
            committedMachines: Number(committedMachines),
            reason: String(reason),
          });
          onDone(`${name} is on an Enterprise contract.`);
        }}
        onClose={onClose}
      />
    );
  return (
    <AdminPromptDialog
      title={`Assisted onboarding for ${name}`}
      description="A$2,500 per site (from the price book), invoiced once when you mark the job complete under Onboarding. You can waive it there with a reason."
      confirmLabel="Schedule"
      fields={[{ name: "siteName", label: "Site", placeholder: "e.g. Pit 4, Moranbah" }]}
      onConfirm={async ({ siteName }) => {
        await scheduleOnboardingRequest(token(), accountId, String(siteName));
        onDone(`Onboarding scheduled for ${name}.`);
      }}
      onClose={onClose}
    />
  );
};
