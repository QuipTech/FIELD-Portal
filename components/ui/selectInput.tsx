import type { SelectHTMLAttributes } from "react";
import { Icon } from "../icons/icon";

// A native <select> (keyboard and screen-reader behaviour for free) with
// our own chevron: browsers draw theirs flush against the edge and ignore
// right padding.
export const SelectInput = ({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <span className="relative flex">
    <select
      {...props}
      className={`h-10 w-full cursor-pointer appearance-none rounded-lg border border-borderGrayStrong bg-surface pl-3 pr-10 text-[15px] text-ink disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </select>
    <Icon name="chevd" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 stroke-mutedGray" />
  </span>
);
