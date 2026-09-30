import { Icon } from "@/components/icons/icon";

interface KnowledgeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export const KnowledgeSearchBar = ({ value, onChange }: KnowledgeSearchBarProps) => {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-borderGrayStrong bg-surface px-3">
      <Icon name="search" className="stroke-mutedGray" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search manuals, procedures, bulletins…"
        aria-label="Search knowledge"
        maxLength={500}
        className="w-full flex-1 border-none bg-transparent text-[15px] text-ink outline-none placeholder:text-mutedGray"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="flex-none text-mutedGray hover:text-ink"
        >
          <Icon name="x" className="stroke-mutedGray" />
        </button>
      )}
    </div>
  );
};
