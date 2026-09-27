import { Card } from "@/components/ui/card";
import { usageBySite } from "@/lib/mockData/aiConfiguration";

export const UsageBySiteCard = () => {
  return (
    <Card className="gap-3">
      <h2 className="text-base font-medium text-ink">Usage by site</h2>
      <div className="flex flex-col gap-2">
        {usageBySite.map((row) => (
          <div key={row.site} className="flex items-center gap-2.5">
            <span className="w-[70px] flex-none text-[15px] text-bodyGray">{row.site}</span>
            <span className="h-2 flex-1 rounded-full bg-fillGray">
              <span style={{ width: `${row.percent}%` }} className="block h-full rounded-full bg-primary" />
            </span>
            <span className="w-10 flex-none text-right text-xs text-mutedGray">{row.queries}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};
