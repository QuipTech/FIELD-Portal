export interface MachineModelSummary {
  id: string;
  manufacturerName: string;
  name: string;
  // "<manufacturer> <model>", e.g. "CAT 793F".
  displayName: string;
  category: string | null;
  // null for the shared catalog; otherwise the organisation's own model.
  organisation: { id: string; name: string } | null;
  // Whether the caller may change it: the Owner any model, an organisation
  // admin only
  // their own organisation's.
  isEditable: boolean;
  systemsCount: number;
  assetsCount: number;
}

export interface ModelComponent {
  id: string;
  name: string;
}

export interface ModelSystem {
  id: string;
  name: string;
  componentCount: number;
  components: ModelComponent[];
}

export interface ModelSystemTree {
  modelId: string;
  systems: ModelSystem[];
}
