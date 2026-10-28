import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/actionMenu";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { getInitials } from "@/lib/format/nameInitials";
import type { OrganisationBilling } from "@/lib/types/billingAccount";

export type BillingAccountAction = "suspend" | "unsuspend" | "enterprise" | "onboarding";

interface BillingAccountsTableProps {
  organisations: OrganisationBilling[];
  onSetUp: (organisation: OrganisationBilling) => void;
  onAction: (organisation: OrganisationBilling, action: BillingAccountAction) => void;
}

const PLAN_NAMES: Record<string, string> = {
  ASSET_PRO: "Asset Professional",
  ENTERPRISE: "Enterprise",
  INTERNAL: "Internal",
  TECH: "Technician",
};

const describePlan = (plan: NonNullable<OrganisationBilling["plan"]>) =>
  `${PLAN_NAMES[plan.planCode] ?? plan.planCode} · ${plan.term === "annual" ? `annual, ${plan.committedQty}` : "monthly"}`;

const actionsFor = (organisation: OrganisationBilling, onAction: BillingAccountsTableProps["onAction"]): ActionMenuItem[] => {
  const account = organisation.billingAccount;
  if (!account) return [];
  return [
    account.suspendedAt
      ? { label: "Lift suspension", icon: "check", onSelect: () => onAction(organisation, "unsuspend") }
      : { label: "Suspend for non-payment", icon: "lock", tone: "danger", onSelect: () => onAction(organisation, "suspend") },
    { label: "Set up Enterprise contract", icon: "file", onSelect: () => onAction(organisation, "enterprise") },
    { label: "Schedule assisted onboarding", icon: "tool", onSelect: () => onAction(organisation, "onboarding") },
  ];
};

export const BillingAccountsTable = ({ organisations, onSetUp, onAction }: BillingAccountsTableProps) => {
  return (
    <Table>
      <TableHeaderRow>
        <TableHeaderCell flex={1.6}>Organisation</TableHeaderCell>
        <TableHeaderCell flex={1.5}>Billing email</TableHeaderCell>
        <TableHeaderCell flex={1.3}>Plan</TableHeaderCell>
        <TableHeaderCell flex={1.3}>Payments</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Account</TableHeaderCell>
        <TableHeaderCell flex={0.4}> </TableHeaderCell>
      </TableHeaderRow>
      {organisations.length === 0 && <div className="px-4 py-6 text-sm text-mutedGray">No organisations yet.</div>}
      {organisations.map((organisation) => {
        const account = organisation.billingAccount;
        return (
          <TableRow key={organisation.organisationId}>
            <TableCell flex={1.6} className="flex items-center gap-2.5">
              <Avatar initials={getInitials(organisation.organisationName)} size="sm" />
              <span className="truncate font-medium">{organisation.organisationName}</span>
            </TableCell>
            <TableCell flex={1.5} className="truncate text-bodyGray">
              {account?.billingEmail ?? "—"}
            </TableCell>
            <TableCell flex={1.3} className="flex flex-wrap items-center gap-1.5 text-bodyGray">
              {organisation.plan ? describePlan(organisation.plan) : "—"}
              {organisation.plan?.status === "cancelling" && <Tag tone="amber">Ending</Tag>}
            </TableCell>
            <TableCell flex={1.3} className="flex flex-wrap items-center gap-1.5">
              {account?.suspendedAt && <Tag tone="danger">Suspended</Tag>}
              {organisation.overdueInvoiceCount > 0 && (
                <Tag tone="amber">{organisation.overdueInvoiceCount} overdue</Tag>
              )}
              {organisation.usageFlagged && <Tag tone="danger">Over allowance</Tag>}
              {account && !account.suspendedAt && organisation.overdueInvoiceCount === 0 && !organisation.usageFlagged && (
                <span className="text-sm text-bodyGray">{account.stripeCustomerId ? "Up to date" : "Stripe not linked yet"}</span>
              )}
            </TableCell>
            <TableCell flex={0.8}>
              {account ? (
                <Tag tone="ok">Set up</Tag>
              ) : (
                <Button size="sm" variant="primary" onClick={() => onSetUp(organisation)}>
                  Set up
                </Button>
              )}
            </TableCell>
            <TableCell flex={0.4}>
              {account && <ActionMenu label={`Billing actions for ${organisation.organisationName}`} items={actionsFor(organisation, onAction)} />}
            </TableCell>
          </TableRow>
        );
      })}
    </Table>
  );
};
