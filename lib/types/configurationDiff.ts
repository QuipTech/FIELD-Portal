export interface ConfigurationSnapshot {
  id: string;
  dateLabel: string;
  takenBy: string;
  trigger: string;
}

export type DiffChangeKind = "Changed" | "Added" | "Removed";

export interface ConfigurationDiffRow {
  kind: DiffChangeKind;
  component: string;
  before: string;
  after: string;
}
