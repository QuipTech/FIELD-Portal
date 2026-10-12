import { Avatar } from "@/components/ui/avatar";
import { abbreviateName, getInitials } from "@/lib/format/nameInitials";

// A person in the queue: initials avatar and "D. Lee".
export const CasePersonCell = ({ name, avatarUrl = null }: { name: string; avatarUrl?: string | null }) => (
  <span className="flex min-w-0 items-center gap-2">
    <Avatar initials={getInitials(name)} imageSrc={avatarUrl ?? undefined} size="md" />
    <span className="truncate">{abbreviateName(name)}</span>
  </span>
);
