import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ListItem } from "@/components/ui/listItem";
import type { IconName } from "@/components/icons/icon";
import { formatElapsedTime } from "@/lib/format/elapsedTimeLabel";
import type { AuditLogEvent } from "@/lib/types/auditLog";

// By the audit entity type; anything else gets the generic file icon.
const ENTITY_ICONS: Record<string, IconName> = {
  user: "users",
  role: "shield",
  knowledge_item: "book",
  machine: "truck",
  machine_model: "db",
  model_system: "db",
  model_component: "db",
  ai_prompt_version: "sliders",
  ai_review_item: "spark",
  tenant_subscription: "card",
  organisation_branding: "settings",
  alert_rule: "bell",
};

export const LatestActionsCard = ({ actions }: { actions: AuditLogEvent[] }) => {
  return (
    <Card className="gap-0.5">
      <div className="mb-1.5 flex items-baseline">
        <h2 className="text-base font-medium text-ink">Latest admin actions</h2>
        <Link href="/admin/audit-log" className="ml-auto text-xs text-primary">
          Audit log
        </Link>
      </div>
      {actions.length === 0 && <span className="py-6 text-center text-sm text-mutedGray">No changes recorded yet.</span>}
      {actions.map((action) => (
        <ListItem
          key={action.id}
          icon={ENTITY_ICONS[action.entityType] ?? "file"}
          title={action.target ? `${action.actionLabel} · ${action.target}` : action.actionLabel}
          subtitle={[action.actor?.name ?? "System", formatElapsedTime(new Date(action.occurredAt))].join(" · ")}
        />
      ))}
    </Card>
  );
};
