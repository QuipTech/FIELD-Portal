import { Icon, type IconName } from "@/components/icons/icon";
import type { KnowledgeDocumentType } from "@/lib/types/adminDocument";

interface KnowledgeFilterNavProps {
  type: KnowledgeDocumentType | "";
  make: string;
  // Makes that searchable documents mention.
  makes: { id: string; name: string }[];
  onTypeChange: (type: KnowledgeDocumentType | "") => void;
  // Choosing the selected make again clears it.
  onMakeChange: (makeId: string) => void;
}

const docTypeLinks: { value: KnowledgeDocumentType | ""; label: string; icon: IconName }[] = [
  { value: "", label: "All types", icon: "file" },
  { value: "manual", label: "Manuals", icon: "book" },
  { value: "procedure", label: "Procedures", icon: "tool" },
  { value: "bulletin", label: "Bulletins", icon: "alert" },
  { value: "policy", label: "Safety & policy", icon: "shield" },
  { value: "parts_book", label: "Parts books", icon: "layers" },
];

const sectionLabelClasses = "px-2.5 pb-2 text-xs font-semibold uppercase tracking-wider text-indigo-300/70";

const NavButton = ({ label, icon, isActive, onClick }: { label: string; icon: IconName; isActive: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={isActive}
    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[15px] transition-colors ${
      isActive ? "bg-white/15 font-medium text-white" : "text-indigo-200/80 hover:bg-white/10 hover:text-white"
    }`}
  >
    <Icon name={icon} className={isActive ? "stroke-white" : "stroke-indigo-200/70"} />
    <span className="truncate">{label}</span>
  </button>
);

export const KnowledgeFilterNav = ({ type, make, makes, onTypeChange, onMakeChange }: KnowledgeFilterNavProps) => {
  return (
    <nav aria-label="Knowledge filters" className="flex w-[200px] flex-none flex-col gap-0.5 overflow-y-auto rounded-2xl bg-[#2D1B69] p-3">
      <span className={`pt-1 ${sectionLabelClasses}`}>Document type</span>
      {docTypeLinks.map((link) => (
        <NavButton
          key={link.value || "all"}
          label={link.label}
          icon={link.icon}
          isActive={type === link.value}
          onClick={() => onTypeChange(link.value)}
        />
      ))}
      {makes.length > 0 && (
        <>
          <span className={`mt-2 border-t border-white/15 pt-3.5 ${sectionLabelClasses}`}>Machine make</span>
          {makes.map((option) => (
            <NavButton
              key={option.id}
              label={option.name}
              icon="truck"
              isActive={make === option.id}
              onClick={() => onMakeChange(make === option.id ? "" : option.id)}
            />
          ))}
        </>
      )}
    </nav>
  );
};
