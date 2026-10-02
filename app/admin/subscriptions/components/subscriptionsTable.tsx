import { Icon } from "@/components/icons/icon";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { ComingSoonButton } from "@/components/ui/comingSoonButton";
import { buttonBaseClasses, buttonSizeClasses, buttonVariantClasses } from "@/components/ui/buttonStyles";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { getInitials } from "@/lib/format/nameInitials";
import type { TenantSubscription } from "@/lib/types/tenantSubscription";
import {
  describeAddOns,
  describeAiUsage,
  describeBillingBasis,
  describeRenewal,
  getStatusOption,
  getTierOption,
} from "../subscriptionLabels";

interface SubscriptionsTableProps {
  items: TenantSubscription[];
  // Omitted for an Owner, who can only read their own subscription.
  onEdit?: (item: TenantSubscription) => void;
}

const notifyButtonClasses = `${buttonBaseClasses} ${buttonVariantClasses.default} ${buttonSizeClasses.sm}`;

export const SubscriptionsTable = ({ items, onEdit }: SubscriptionsTableProps) => {
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
      {items.length === 0 && (
        <div className="px-4 py-6 text-sm text-mutedGray">No organisations match this filter.</div>
      )}
      {items.map((item) => {
        const statusOption = getStatusOption(item.status);
        const canNotify = item.status === "expiring_soon" || item.status === "expired";
        return (
          <TableRow
            key={item.tenantId}
            onClick={onEdit ? () => onEdit(item) : undefined}
            className={onEdit ? "cursor-pointer hover:bg-fillGray" : ""}
          >
            <TableCell flex={1.8} className="flex items-center gap-2.5">
              <Avatar initials={getInitials(item.tenantName)} size="sm" />
              <span className="truncate font-medium">{item.tenantName}</span>
            </TableCell>
            <TableCell>
              {item.subscription ? (
                <Tag tone={getTierOption(item.subscription.tier).tone}>
                  {getTierOption(item.subscription.tier).label}
                </Tag>
              ) : (
                <span className="text-xs text-mutedGray">—</span>
              )}
            </TableCell>
            <TableCell flex={1.3} className="text-bodyGray">
              {describeBillingBasis(item)}
            </TableCell>
            <TableCell flex={1.2} className="text-bodyGray">
              {describeAiUsage(item)}
            </TableCell>
            <TableCell flex={1.6} className="text-xs text-mutedGray">
              {describeAddOns(item)}
            </TableCell>
            <TableCell className="text-bodyGray">{describeRenewal(item)}</TableCell>
            <TableCell flex={0.9}>
              <Tag tone={statusOption.tone}>{statusOption.label}</Tag>
            </TableCell>
            {/* Clicks here mustn't also open the editor. */}
            <TableCell flex={0.8} className="overflow-visible">
              <span onClick={(event) => event.stopPropagation()}>
                {canNotify && onEdit && (
                  <ComingSoonButton label="Notify" className={notifyButtonClasses}>
                    <Icon name="msg" className="h-3.5 w-3.5" />
                    Notify
                  </ComingSoonButton>
                )}
              </span>
            </TableCell>
          </TableRow>
        );
      })}
    </Table>
  );
};
