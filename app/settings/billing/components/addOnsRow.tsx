import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";

const addOns = [
  { name: "Wearable client seats", usage: "6 seats", caption: "Per named user, per month" },
  { name: "Remote expert sessions", usage: "2 concurrent", caption: "Per concurrent session" },
];

export const AddOnsRow = () => {
  return (
    <div className="flex gap-3.5">
      {addOns.map((addOn) => (
        <Card key={addOn.name} className="flex-1 gap-1.5">
          <div className="flex items-center">
            <span className="text-[15px] font-medium text-ink">{addOn.name}</span>
            <Tag tone="primary" className="ml-auto">{addOn.usage}</Tag>
          </div>
          <span className="text-xs text-mutedGray">{addOn.caption}</span>
        </Card>
      ))}
    </div>
  );
};
