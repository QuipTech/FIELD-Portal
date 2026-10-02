export type AiPlatformUsageSource = 'prompt_test' | 'indexing' | 'search';

export interface AiPlatformUsageEntry {
  // null for platform work: prompt tests and shared-library documents.
  tenantId: string | null;
  source: AiPlatformUsageSource;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}
