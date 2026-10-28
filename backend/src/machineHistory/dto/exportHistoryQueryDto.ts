import { IsIn } from 'class-validator';
import { HistoryFilterQueryDto } from './listHistoryQueryDto';

export const HISTORY_EXPORT_FORMATS = ['csv', 'pdf'] as const;
export type HistoryExportFormat = (typeof HISTORY_EXPORT_FORMATS)[number];

// GET /machines/:machineId/history/export — the whole filtered history.
export class ExportHistoryQueryDto extends HistoryFilterQueryDto {
  @IsIn(HISTORY_EXPORT_FORMATS)
  format: HistoryExportFormat;
}
