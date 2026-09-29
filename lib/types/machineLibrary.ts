export interface MachineModelSummary {
  id: string;
  manufacturerName: string;
  name: string;
  // "<manufacturer> <model>", e.g. "CAT 793F".
  displayName: string;
  category: string | null;
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

export interface CreateMachineModelPayload {
  manufacturerName: string;
  name: string;
  category?: string;
}

export type ImportTreeMode = "merge" | "replace";

// merge adds what's missing (names match case-insensitively); replace
// swaps out the model's whole tree.
export interface ImportModelTreePayload {
  mode: ImportTreeMode;
  systems: { name: string; components?: string[] }[];
}
