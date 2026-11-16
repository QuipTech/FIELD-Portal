import { ComingSoonPanel } from "@/components/machineControl/comingSoonPanel";

const MachineControlFilesPage = () => (
  <ComingSoonPanel
    icon="upload"
    title="Files"
    description="Your design library: drop in DXF, LandXML and config files, then send them to machines."
    features={[
      "Drag files or whole folders in; the folder structure is kept",
      "Every version is kept, so you can roll back any time",
      "Preview DXF drawings with layers you can turn on and off",
      "Check exactly what each machine gets before you send",
    ]}
  />
);

export default MachineControlFilesPage;
