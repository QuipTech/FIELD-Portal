import { Icon, type IconName } from "@/components/icons/icon";

const docTypeLinks: { label: string; icon: IconName; active?: boolean }[] = [
  { label: "All types", icon: "file", active: true },
  { label: "Manuals", icon: "book" },
  { label: "Procedures", icon: "tool" },
  { label: "Bulletins", icon: "alert" },
  { label: "Safety", icon: "shield" },
];

const makeLinks: { label: string; icon: IconName }[] = [
  { label: "Caterpillar", icon: "truck" },
  { label: "Komatsu", icon: "truck" },
  { label: "Sandvik", icon: "truck" },
];

export const KnowledgeFilterNav = () => {
  return (
    <div className="flex w-[200px] flex-none flex-col gap-0.5 rounded-2xl bg-[#2D1B69] p-3">
      <span className="px-2.5 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-indigo-300/70">
        Document type
      </span>
      {docTypeLinks.map((link) => (
        <div
          key={link.label}
          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[15px] transition-colors ${
            link.active ? "bg-white/15 font-medium text-white" : "text-indigo-200/80 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon name={link.icon} className={link.active ? "stroke-white" : "stroke-indigo-200/70"} />
          {link.label}
        </div>
      ))}
      <span className="mt-2 border-t border-white/15 px-2.5 pb-2 pt-3.5 text-xs font-semibold uppercase tracking-wider text-indigo-300/70">
        Machine make
      </span>
      {makeLinks.map((link) => (
        <div
          key={link.label}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[15px] text-indigo-200/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Icon name={link.icon} className="stroke-indigo-200/70" />
          {link.label}
        </div>
      ))}
    </div>
  );
};
