import { Tag } from "@/components/ui/tag";

interface MachineGroupBadgeProps {
  name: string;
  // #RRGGBB; null shows the default grey dot.
  colour: string | null;
  className?: string;
}

// A machine's customer group: its colour as a dot beside the name.
export const MachineGroupBadge = ({ name, colour, className = "" }: MachineGroupBadgeProps) => (
  <Tag className={`max-w-full ${className}`}>
    <span
      aria-hidden="true"
      className={`h-2 w-2 flex-none rounded-full ${colour ? "" : "bg-mutedGray"}`}
      style={colour ? { backgroundColor: colour } : undefined}
    />
    <span className="truncate">{name}</span>
  </Tag>
);
