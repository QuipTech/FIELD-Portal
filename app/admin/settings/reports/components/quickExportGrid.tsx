import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/iconTile";
import { quickExports } from "@/lib/mockData/reportsExports";

export const QuickExportGrid = () => {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
      {quickExports.map((item) => (
        <div key={item.id} className="flex flex-col gap-3.5 rounded-2xl border border-slate-200/80 bg-surface p-5">
          <IconTile icon={item.icon} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-slate-900">{item.title}</span>
            <span className="text-xs text-mutedGray">{item.caption}</span>
          </div>
          <Button className="mt-auto w-full">
            <Icon name="download" className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      ))}
    </div>
  );
};
