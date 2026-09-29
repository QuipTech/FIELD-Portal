import { Icon } from "@/components/icons/icon";

const systems = ["Powertrain", "Hydraulics", "Brakes", "Electrical", "Chassis", "Operator cab"];

export const SystemsSideNav = () => {
  return (
    <div className="flex w-[200px] flex-none flex-col gap-0.5 rounded-r-[18px] bg-gradient-to-b from-brandDeep to-[#221C52] p-3">
      <span className="px-2.5 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-white/50">Systems</span>
      {systems.map((system, index) => (
        <div
          key={system}
          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[15px] transition-colors ${
            index === 0
              ? "bg-white/[0.16] font-medium text-white"
              : "text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon name="layers" className={index === 0 ? "stroke-white" : "stroke-white/60"} />
          {system}
        </div>
      ))}
    </div>
  );
};
