import { Button } from "./button";
import { Icon } from "../icons/icon";

interface PaginationProps {
  page: number;
  pageSize: number;
  // Rows matching the list's filters, across every page.
  total: number;
  onPageChange: (page: number) => void;
}

// "26–50 of 80  ‹ Previous  Page 2 of 4  Next ›" under a paged list.
// Renders nothing while everything fits on one page.
export const Pagination = ({ page, pageSize, total, onPageChange }: PaginationProps) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Pagination" className="flex flex-none items-center gap-2 text-xs text-mutedGray">
      <span>
        {first}–{last} of {total.toLocaleString("en-GB")}
      </span>
      <Button size="sm" className="ml-auto" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        <Icon name="chevl" className="h-3.5 w-3.5" />
        Previous
      </Button>
      <span>
        Page {page} of {pageCount}
      </span>
      <Button size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
        Next
        <Icon name="chevr" className="h-3.5 w-3.5" />
      </Button>
    </nav>
  );
};
