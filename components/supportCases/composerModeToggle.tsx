export type ComposerMode = "reply" | "internal";

const OPTIONS: { value: ComposerMode; label: string; activeClasses: string }[] = [
  { value: "reply", label: "Reply to customer", activeClasses: "border-primaryBorder bg-primaryTint text-primary" },
  { value: "internal", label: "Internal note", activeClasses: "border-amberBorder bg-amberTint text-amber" },
];

// Staff choose who a message is for; an internal note shows amber.
export const ComposerModeToggle = ({ mode, onChange }: { mode: ComposerMode; onChange: (mode: ComposerMode) => void }) => (
  <div role="radiogroup" aria-label="Message type" className="flex gap-2">
    {OPTIONS.map((option) => {
      const isActive = option.value === mode;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={isActive}
          onClick={() => onChange(option.value)}
          className={`rounded-md border px-3 py-1 text-sm ${
            isActive ? option.activeClasses : "border-borderGray bg-fillGray text-bodyGray hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
