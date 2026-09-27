import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";

const filters = ["All types", "Last 90 days", "Author"];

export const HistoryFilterBar = () => {
  return (
    <div className="flex items-center gap-2">
      {filters.map((filter) => (
        <Tag key={filter}>
          {filter}
          <Icon name="chevd" className="h-3.5 w-3.5" />
        </Tag>
      ))}
    </div>
  );
};
