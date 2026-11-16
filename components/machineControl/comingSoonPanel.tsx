import { Icon, type IconName } from "@/components/icons/icon";

interface ComingSoonPanelProps {
  icon: IconName;
  title: string;
  description: string;
  // What the section will do, in plain words.
  features: string[];
}

// A section that's planned but not built: what it will be, so nobody wonders.
export const ComingSoonPanel = ({ icon, title, description, features }: ComingSoonPanelProps) => (
  <section className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-borderGrayStrong bg-surface px-6 py-12 text-center">
    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primaryTint text-primaryHover">
      <Icon name={icon} className="h-7 w-7" />
    </span>
    <div className="flex flex-col items-center gap-1.5">
      <span className="rounded-full bg-fillGray px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-mutedGray">Coming soon</span>
      <h2 className="text-[19px] font-medium text-ink">{title}</h2>
      <p className="max-w-md text-sm text-bodyGray">{description}</p>
    </div>
    <ul className="flex flex-col gap-2 text-left">
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-2 text-sm text-bodyGray">
          <Icon name="check" className="mt-0.5 h-4 w-4 flex-none stroke-primaryHover" />
          {feature}
        </li>
      ))}
    </ul>
  </section>
);
