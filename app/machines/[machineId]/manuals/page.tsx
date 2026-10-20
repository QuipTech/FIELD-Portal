"use client";

import { EmptyState } from "@/components/ui/emptyState";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { KnowledgeResultCard } from "@/components/knowledge/knowledgeResultCard";
import { machineManualsNavigation } from "@/lib/knowledge/knowledgeLinks";
import { useMachineDetail } from "../machineDetailContext";
import { useMachineManuals } from "./useMachineManuals";

// Manuals tab: the knowledge library's documents for this machine's model.
// Each opens inside the machine page rather than on the Knowledge screen.
const MachineManualsPage = () => {
  const { machineId, machine } = useMachineDetail();
  const manuals = useMachineManuals(machine?.modelId ?? null);
  const navigation = machineManualsNavigation(machineId);
  const items = manuals.data?.items ?? [];

  if (!machine || (manuals.isLoading && !manuals.data)) {
    return (
      <div className="flex justify-center py-10 text-mutedGray">
        <LoadingSpinner size="md" />
      </div>
    );
  }
  if (manuals.error) return <LoadErrorState message={manuals.error} onRetry={manuals.reload} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon="file"
        title="No manuals for this model yet"
        description={`Documents for the ${machine.manufacturer} ${machine.model} appear here once they're indexed and live.`}
      />
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
        {machine.manufacturer} {machine.model} documents · {manuals.data?.total ?? items.length}
      </span>
      {items.map((result) => (
        <KnowledgeResultCard key={result.id} result={result} navigation={navigation} />
      ))}
    </section>
  );
};

export default MachineManualsPage;
