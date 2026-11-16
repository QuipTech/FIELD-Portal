import { ComingSoonPanel } from "@/components/machineControl/comingSoonPanel";

const MachineControlActivityPage = () => (
  <ComingSoonPanel
    icon="history"
    title="Activity"
    description="Everything that happened in Machine Control: who sent what, to which machine, and when."
    features={[
      "Filter by date, site, machine, person or action",
      "See deliveries, recalls, roll-backs and connections",
      "Export to CSV for your records",
    ]}
  />
);

export default MachineControlActivityPage;
