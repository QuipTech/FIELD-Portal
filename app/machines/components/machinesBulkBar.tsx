import { Button } from "@/components/ui/button";

interface MachinesBulkBarProps {
  selectedCount: number;
  // Of the ticked machines, those that can be activated.
  activatableCount: number;
  // Shown once the last bulk action is done and nothing is ticked.
  notice: string | null;
  onActivate: () => void;
  onClear: () => void;
}

// The actions for the machines ticked in the table.
export const MachinesBulkBar = ({
  selectedCount,
  activatableCount,
  notice,
  onActivate,
  onClear,
}: MachinesBulkBarProps) => {
  if (selectedCount === 0 && !notice) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primaryBorder bg-primaryTint px-3 py-2 text-sm text-primaryTintText">
      {selectedCount > 0 ? (
        <>
          <span>{selectedCount} selected</span>
          {activatableCount > 0 && (
            <Button size="sm" variant="primary" onClick={onActivate}>
              Activate {activatableCount}
            </Button>
          )}
          <button type="button" className="underline" onClick={onClear}>
            Clear
          </button>
        </>
      ) : (
        <span role="status">{notice}</span>
      )}
    </div>
  );
};
