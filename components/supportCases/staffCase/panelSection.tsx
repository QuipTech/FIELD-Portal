import type { ReactNode } from "react";

// The dark case panel's building blocks (A13b).

export const PanelHeading = ({ children }: { children: ReactNode }) => (
  <span className="text-sm font-semibold uppercase tracking-wider text-indigo-200/70">{children}</span>
);

export const PanelSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-3 border-b border-white/10 px-6 py-6 last:border-b-0">
    <PanelHeading>{title}</PanelHeading>
    {children}
  </section>
);

export const PanelRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 text-[15px]">
    <span className="text-indigo-200/60">{label}</span>
    <span className="text-right text-white">{children}</span>
  </div>
);

// A div, not a label: the assignee field holds a whole dropdown of buttons.
// Selects inside name themselves with aria-label.
export const PanelField = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[15px] text-indigo-200/60">{label}</span>
    {children}
    {hint && <span className="text-sm leading-snug text-indigo-200/50">{hint}</span>}
  </div>
);

export const panelSelectClasses =
  "h-11 w-full rounded-lg border-none bg-surface px-3.5 text-[15px] text-ink outline-none disabled:opacity-70";
