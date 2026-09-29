import Link from "next/link";
import { Icon, type IconName } from "@/components/icons/icon";

const sections: { label: string; icon: IconName; active?: boolean }[] = [
  { label: "Prerequisites", icon: "check", active: true },
  { label: "Tools", icon: "tool" },
  { label: "Steps", icon: "activity" },
  { label: "Torque specs", icon: "sliders" },
];

const relatedLinks = [
  { label: "Bulletin 88 — revised pressures", href: "/knowledge/bulletin-88-revised-charge-pressure" },
  { label: "Suspension specifications p. 214", href: "/knowledge/suspension-system-specifications" },
];

export const ArticleTocRail = () => {
  return (
    <div className="flex w-[212px] flex-none flex-col gap-0.5 rounded-2xl bg-gradient-to-b from-brandDeep to-[#221C52] p-3">
      <span className="px-2.5 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-white/50">On this page</span>
      {sections.map((section) => (
        <div
          key={section.label}
          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[15px] ${
            section.active ? "bg-white/[0.16] font-medium text-white" : "text-white/75"
          }`}
        >
          <Icon name={section.icon} className={section.active ? "stroke-white" : "stroke-white/60"} />
          {section.label}
        </div>
      ))}
      <span className="mt-2 border-t border-white/[0.16] px-2.5 pb-2 pt-3.5 text-xs font-medium uppercase tracking-wide text-white/50">
        Related
      </span>
      <div className="flex flex-col gap-2 px-2.5">
        {relatedLinks.map((link) => (
          <Link key={link.href} href={link.href} className="text-[13px] text-white/75 underline">
            {link.label}
          </Link>
        ))}
      </div>
      <button className="mx-2.5 mt-auto flex h-9 items-center justify-center gap-2 rounded-lg bg-white/[0.16] text-[15px] font-medium text-white">
        <Icon name="spark" />
        Ask AI
      </button>
    </div>
  );
};
