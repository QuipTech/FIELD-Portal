import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";

interface DocumentContextTagProps {
  title: string;
  onClear: () => void;
}

// From a Knowledge article's "Ask AI": the next question is answered from
// this document only.
export const DocumentContextTag = ({ title, onClear }: DocumentContextTagProps) => (
  <Tag tone="amber" className="max-w-[280px]">
    <Icon name="book" className="h-3.5 w-3.5 flex-none" />
    <span className="truncate">Answering from: {title}</span>
    <button type="button" aria-label="Stop answering from this document" onClick={onClear} className="flex-none">
      <Icon name="x" className="h-3 w-3" />
    </button>
  </Tag>
);
