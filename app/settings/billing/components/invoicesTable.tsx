import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { invoices } from "@/lib/mockData/invoices";

export const InvoicesTable = () => {
  return (
    <Table className="flex-none">
      <TableHeaderRow>
        <TableHeaderCell>Date</TableHeaderCell>
        <TableHeaderCell flex={1.4}>Description</TableHeaderCell>
        <TableHeaderCell>Amount</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Status</TableHeaderCell>
        <TableHeaderCell flex={0.8}> </TableHeaderCell>
      </TableHeaderRow>
      {invoices.map((invoice) => (
        <TableRow key={invoice.id}>
          <TableCell className="text-bodyGray">{invoice.dateLabel}</TableCell>
          <TableCell flex={1.4} className="font-medium">{invoice.description}</TableCell>
          <TableCell className="text-bodyGray">Charged via Stripe</TableCell>
          <TableCell flex={0.8}><Tag tone="ok">Paid</Tag></TableCell>
          <TableCell flex={0.8}>
            <Icon name="download" className="stroke-mutedGray" />
          </TableCell>
        </TableRow>
      ))}
    </Table>
  );
};
