import { audMoney } from "@/lib/format/audMoney";
import type { AllowanceMetric, OrganisationPlan } from "@/lib/types/organisationBilling";

// "1–25 machines A$35.00 · 26–99 A$29.00 · 100+ A$25.00"
export const describeBands = (bands: OrganisationPlan["bands"]): string =>
  bands
    .map((band) => `${band.upperQty === null ? `${band.lowerQty}+` : `${band.lowerQty}–${band.upperQty}`} ${audMoney(band.unitCents)}`)
    .join(" · ");

export const METRIC_LABELS: Record<AllowanceMetric, { name: string; unit: (value: number) => string }> = {
  ai_turns: { name: "AI assistant", unit: (value) => `${value.toLocaleString("en-AU")} questions` },
  storage_bytes: { name: "Storage", unit: (value) => formatBytes(value) },
  ingest_pages: { name: "Document ingestion", unit: (value) => `${value.toLocaleString("en-AU")} pages` },
};

const formatBytes = (bytes: number): string => {
  const gigabytes = bytes / 1024 ** 3;
  if (gigabytes >= 1) return `${gigabytes.toFixed(gigabytes >= 10 ? 0 : 1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
};
