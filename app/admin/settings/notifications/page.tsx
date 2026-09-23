import { Icon } from "@/components/icons/icon";
import { AlertRulesTable } from "./components/alertRulesTable";
import { DeliveryChannelsGrid } from "./components/deliveryChannelsGrid";

const NotificationsSettingsPage = () => {
  return (
    <>
      <div className="flex items-center">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Settings · Notifications</span>
          <h1 className="text-xl font-bold text-slate-900">Notifications &amp; alert rules</h1>
        </div>
        <button className="ml-auto flex items-center gap-1.5 rounded-xl bg-[#4F39F6] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4330db]">
          <Icon name="plus" className="h-4 w-4" />
          New rule
        </button>
      </div>
      <div>
        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-800">Alert rules</h2>
        <AlertRulesTable />
      </div>
      <div>
        <h2 className="mb-4 mt-8 text-lg font-semibold text-slate-900">Delivery channels</h2>
        <DeliveryChannelsGrid />
      </div>
    </>
  );
};

export default NotificationsSettingsPage;
