import type { ReactNode } from "react";
import { Icon } from "@/components/icons/icon";

interface FilterButtonProps {
  children: ReactNode;
}

export const FilterButton = ({ children }: FilterButtonProps) => {
  return (
    <button
      type="button"
      className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      {children}
      <Icon name="chevd" className="h-3.5 w-3.5" />
    </button>
  );
};
