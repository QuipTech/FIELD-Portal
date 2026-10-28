import type { OrganisationBillingSummary } from "@/lib/types/organisationBilling";
import { METRIC_LABELS } from "./planDescriptions";

const BAR_TONES = { ok: "bg-primary", notified: "bg-amber", flagged: "bg-danger" } as const;

// Fair use this month, pooled across the organisation. Reaching an
// allowance never blocks or charges anything.
export const AllowanceUsageCard = ({ allowance }: { allowance: OrganisationBillingSummary["allowance"] }) => {
  if (!allowance.length) return null;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-borderGray bg-surface p-5">
      <h2 className="font-medium text-ink">Fair use this month</h2>
      {allowance.map((row) => {
        const label = METRIC_LABELS[row.metric];
        const percent = row.allowance > 0 ? Math.min(100, Math.round((row.used / row.allowance) * 100)) : row.used > 0 ? 100 : 0;
        return (
          <div key={row.metric} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink">{label.name}</span>
              <span className="text-bodyGray">{label.unit(row.used)} of {label.unit(row.allowance)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-fillGray" role="progressbar" aria-label={label.name} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${percent}%` }} className={`h-full ${BAR_TONES[row.thresholdState]}`} />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-bodyGray">
        Allowances grow with your active machines. Going over never blocks or slows anyone down and adds nothing to your
        invoice; QuipTech may suggest a better-fitting plan.
      </p>
    </section>
  );
};
