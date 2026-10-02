import { Tag } from "@/components/ui/tag";

// Who an admin-portal item belongs to: the whole platform ("Shared") or
// one organisation (its name).
export const OwnershipTag = ({ organisationName }: { organisationName: string | null }) =>
  organisationName ? <Tag>{organisationName}</Tag> : <Tag tone="primary">Shared</Tag>;
