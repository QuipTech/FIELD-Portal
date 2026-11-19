import { EmptyState } from "@/components/ui/emptyState";

// What Machine Control shows to an organisation that doesn't have it yet.
export const MachineControlOffNotice = () => (
  <EmptyState
    icon="broadcast"
    title="Machine Control isn't turned on yet"
    description="Machine Control sends design files to the tablets on your machines and shows them arriving. Ask QuipTech to turn it on for your organisation."
  />
);
