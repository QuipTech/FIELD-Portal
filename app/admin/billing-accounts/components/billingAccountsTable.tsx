import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { getInitials } from "@/lib/format/nameInitials";
import type { OrganisationBilling } from "@/lib/types/billingAccount";

interface BillingAccountsTableProps {
  organisations: OrganisationBilling[];
  onSetUp: (organisation: OrganisationBilling) => void;
}

const describeStripe = (organisation: OrganisationBilling) =>
  organisation.billingAccount?.stripeCustomerId ? "Linked" : "Not linked yet";

export const BillingAccountsTable = ({ organisations, onSetUp }: BillingAccountsTableProps) => {
  return (
    <Table>
      <TableHeaderRow>
        <TableHeaderCell flex={1.8}>Organisation</TableHeaderCell>
        <TableHeaderCell flex={1.6}>Billing email</TableHeaderCell>
        <TableHeaderCell flex={1.2}>Time zone</TableHeaderCell>
        <TableHeaderCell>Stripe</TableHeaderCell>
        <TableHeaderCell>Account</TableHeaderCell>
      </TableHeaderRow>
      {organisations.length === 0 && <div className="px-4 py-6 text-sm text-mutedGray">No organisations yet.</div>}
      {organisations.map((organisation) => {
        const account = organisation.billingAccount;
        return (
          <TableRow key={organisation.organisationId}>
            <TableCell flex={1.8} className="flex items-center gap-2.5">
              <Avatar initials={getInitials(organisation.organisationName)} size="sm" />
              <span className="truncate font-medium">{organisation.organisationName}</span>
            </TableCell>
            <TableCell flex={1.6} className="truncate text-bodyGray">
              {account?.billingEmail ?? "—"}
            </TableCell>
            <TableCell flex={1.2} className="text-bodyGray">
              {account?.timezone ?? "—"}
            </TableCell>
            <TableCell className="text-bodyGray">{account ? describeStripe(organisation) : "—"}</TableCell>
            <TableCell>
              {account ? (
                <Tag tone={account.suspendedAt ? "danger" : "ok"}>{account.suspendedAt ? "Suspended" : "Set up"}</Tag>
              ) : (
                <Button size="sm" variant="primary" onClick={() => onSetUp(organisation)}>
                  Set up
                </Button>
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </Table>
  );
};
