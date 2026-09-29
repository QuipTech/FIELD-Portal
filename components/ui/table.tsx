import type { CSSProperties, ReactNode } from "react";

interface FlexChildProps {
  children: ReactNode;
  flex?: number;
  className?: string;
}

export const Table = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div
    className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-borderGray bg-surface ${className}`}
  >
    {children}
  </div>
);

export const TableHeaderRow = ({ children }: { children: ReactNode }) => (
  <div className="flex gap-3 border-b border-borderGray bg-fillGray px-4 py-2.5">{children}</div>
);

export const TableHeaderCell = ({ children, flex = 1 }: FlexChildProps) => (
  <div style={{ flex } as CSSProperties} className="text-xs font-medium uppercase tracking-wide text-bodyGray">
    {children}
  </div>
);

interface TableRowProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const TableRow = ({ children, className = "", onClick }: TableRowProps) => (
  <div
    onClick={onClick}
    className={`flex items-center gap-3 border-b border-borderGray px-4 py-3.5 last:border-b-0 ${className}`}
  >
    {children}
  </div>
);

export const TableCell = ({ children, flex = 1, className = "" }: FlexChildProps) => (
  <div style={{ flex } as CSSProperties} className={`min-w-0 truncate text-[15px] text-ink ${className}`}>
    {children}
  </div>
);
