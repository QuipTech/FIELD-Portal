import type { HistoryFilters } from "@/lib/types/historyEntry";

export const HISTORY_PAGE_SIZE = 10;

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = { type: "", range: "90d", authorId: "" };
