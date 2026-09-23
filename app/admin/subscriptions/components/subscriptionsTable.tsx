import { Icon } from "@/components/icons/icon";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { tenantSubscriptions, tenantTierTone, tenantStatusTone } from "@/lib/mockData/tenantSubscriptions";

export const SubscriptionsTable = () => {
  return (
    <Table>
      <TableHeaderRow>
        <TableHeaderCell flex={1.8}>Company</TableHeaderCell>
        <TableHeaderCell>Tier</TableHeaderCell>
        <TableHeaderCell flex={1.3}>Billing basis</TableHeaderCell>
        <TableHeaderCell flex={1.2}>AI usage</TableHeaderCell>
        <TableHeaderCell flex={1.6}>Add-ons</TableHeaderCell>
        <TableHeaderCell>Renews</TableHeaderCell>
        <TableHeaderCell flex={0.9}>Status</TableHeaderCell>
        <TableHeaderCell flex={0.8}> </TableHeaderCell>
      </TableHeaderRow>
      {tenantSubscriptions.map((tenant) => (
        <TableRow key={tenant.id}>
          <TableCell flex={1.8} className="flex items-center gap-2.5">
            <Avatar initials={tenant.initials} size="sm" />
            <span className="font-medium">{tenant.company}</span>
          </TableCell>
          <TableCell>
            <Tag tone={tenantTierTone[tenant.tier]}>{tenant.tier}</Tag>
          </TableCell>
          <TableCell flex={1.3} className="text-bodyGray">{tenant.billingBasis}</TableCell>
          <TableCell flex={1.2} className="text-bodyGray">{tenant.aiUsage}</TableCell>
          <TableCell flex={1.6} className="text-xs text-mutedGray">{tenant.addOns}</TableCell>
          <TableCell className="text-bodyGray">{tenant.renewsLabel}</TableCell>
          <TableCell flex={0.9}>
            <Tag tone={tenantStatusTone[tenant.status]}>{tenant.status}</Tag>
          </TableCell>
          <TableCell flex={0.8}>
            {tenant.canNotify ? (
              <Button size="sm">
                <Icon name="msg" className="h-3.5 w-3.5" />
                Notify
              </Button>
            ) : null}
          </TableCell>
        </TableRow>
      ))}
    </Table>
  );
};
