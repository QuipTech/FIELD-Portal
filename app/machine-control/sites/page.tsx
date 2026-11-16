import { ComingSoonPanel } from "@/components/machineControl/comingSoonPanel";

const MachineControlSitesPage = () => (
  <ComingSoonPanel
    icon="layers"
    title="Sites"
    description="Group the machines working on one job, so files go to all of them at once."
    features={[
      "Create a site with its location and colour",
      "Add machines; new ones get the site's files automatically",
      "Send site files to every machine in one go",
      "Download everything the machines sent back as one zip",
    ]}
  />
);

export default MachineControlSitesPage;
