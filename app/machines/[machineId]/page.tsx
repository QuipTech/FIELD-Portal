"use client";

import { useSearchParams } from "next/navigation";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { EmptyState } from "@/components/ui/emptyState";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/linkButton";
import { Icon } from "@/components/icons/icon";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { useCachedResource } from "@/lib/machineDetail/useCachedResource";
import { machineCacheKeys } from "@/lib/machineDetail/machineDetailCacheKeys";
import { useMachineDetail } from "./machineDetailContext";
import { ComponentStatusCard } from "./components/componentStatusCard";
import { SECTION_LABEL_CLASSES } from "./components/systemsTabs";

// Components tab: the selected system's components (?system=, chosen in
// the systems tabs). Every component loads once, so switching system
// needs no request.
const MachineComponentsPage = () => {
  const { machineId, service } = useMachineDetail();
  // Only platform admins can edit the Machine library, where systems come from.
  const canEditLibrary = usePermissions().can(PERMISSIONS.managePlatform);
  const systems = useCachedResource(machineCacheKeys.systems(machineId), () => service.listSystems(machineId), "Couldn't load systems.");
  const components = useCachedResource(
    machineCacheKeys.components(machineId),
    () => service.listComponents(machineId, null),
    "Couldn't load components.",
  );
  const systemId = useSearchParams().get("system") ?? systems.data?.[0]?.id ?? null;
  const visible = (components.data ?? []).filter((component) => component.systemId === systemId);
  const systemName = systems.data?.find((system) => system.id === systemId)?.name;

  if (components.isLoading || systems.isLoading) {
    return (
      <div aria-busy="true" aria-label="Loading components" className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((card) => (
          <SkeletonBar key={card} className="h-[74px] rounded-xl" />
        ))}
      </div>
    );
  }
  if (components.error) return <LoadErrorState message={components.error} onRetry={components.reload} />;
  if (systems.data?.length === 0 || components.data?.length === 0) {
    return (
      <EmptyState
        icon="layers"
        title="No components recorded yet"
        description="This machine's systems and components come from its model in the Machine library. Once the model is set up, they appear here with their condition from the machine's history."
        actions={
          <>
            <LinkButton href={`/machines/${machineId}/history?add=entry`} variant="primary">
              <Icon name="plus" /> Add history entry
            </LinkButton>
            {canEditLibrary && (
              <LinkButton href="/admin/machines">
                <Icon name="layers" /> Open Machine library
              </LinkButton>
            )}
            <Button
              onClick={() => {
                systems.reload();
                components.reload();
              }}
            >
              Check again
            </Button>
          </>
        }
      />
    );
  }
  if (visible.length === 0) {
    return (
      <EmptyState
        icon="layers"
        title="No components in this system"
        description="Pick another system above, or add this system's components to the model in the Machine library."
      />
    );
  }

  return (
    <section className="flex flex-col gap-1.5">
      <h2 className={SECTION_LABEL_CLASSES}>
        {systemName ? `${systemName} components` : "Components"} · {visible.length}
      </h2>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {visible.map((component) => (
          <ComponentStatusCard key={component.id} component={component} />
        ))}
      </div>
    </section>
  );
};

export default MachineComponentsPage;
