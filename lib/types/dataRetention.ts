export type SchemaVisibilityLevel = "all_tenants_read_only" | "own_rows_read_only" | "service_role_only";

export interface DataSchemaRow {
  name: string;
  contents: string;
  visibility: string;
  level: SchemaVisibilityLevel;
}

export interface RetentionPrinciple {
  id: string;
  icon: "database" | "activity" | "shield";
  text: string;
}

export interface DataRetentionSettings {
  schemas: DataSchemaRow[];
  principles: RetentionPrinciple[];
  retention: { aiQueryLogsMonths: number; allowedMonths: number[] };
}
