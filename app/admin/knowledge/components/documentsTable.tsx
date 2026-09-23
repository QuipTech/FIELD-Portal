import { IconTile } from "@/components/ui/iconTile";
import { Tag } from "@/components/ui/tag";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { adminDocuments } from "@/lib/mockData/adminDocuments";
import { documentStateTone } from "@/lib/types/adminDocument";

export const DocumentsTable = () => {
  return (
    <Table>
      <TableHeaderRow>
        <TableHeaderCell flex={3.2}>Document</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Type</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Indexed</TableHeaderCell>
        <TableHeaderCell flex={0.5}>Pages</TableHeaderCell>
        <TableHeaderCell flex={0.7}>State</TableHeaderCell>
      </TableHeaderRow>
      {adminDocuments.map((document) => (
        <TableRow key={document.id}>
          <TableCell flex={3.2} className="flex items-center gap-2.5">
            <IconTile icon={document.icon} tone={document.iconTone} size="sm" />
            <span className="font-medium">{document.title}</span>
          </TableCell>
          <TableCell flex={0.8} className="text-bodyGray">{document.type}</TableCell>
          <TableCell flex={0.8} className="text-xs text-mutedGray">{document.indexedLabel}</TableCell>
          <TableCell flex={0.5} className="text-bodyGray">{document.pages}</TableCell>
          <TableCell flex={0.7}>
            <Tag tone={documentStateTone[document.state]}>{document.state}</Tag>
          </TableCell>
        </TableRow>
      ))}
    </Table>
  );
};
