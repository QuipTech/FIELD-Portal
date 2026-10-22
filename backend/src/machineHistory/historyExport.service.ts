import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as authRepository from '../auth/auth.repository';
import * as historyEntriesRepository from './historyEntries.repository';
import { assertMachineInTenant } from './machineHistory.service';
import { toHistoryCsv, toHistoryPdf } from './historyExport';
import { ExportHistoryQueryDto } from './dto/exportHistoryQueryDto';

export interface HistoryExportFile {
  body: string | Uint8Array;
  contentType: string;
  fileName: string;
}

// A machine's whole (filtered) technical history as CSV or PDF. Exports
// are audited: they take the record out of the platform.
@Injectable()
export class HistoryExportService {
  constructor(private readonly databaseService: DatabaseService) {}

  exportHistory = (
    actor: AuthenticatedUser,
    machineId: string,
    query: ExportHistoryQueryDto,
  ): Promise<HistoryExportFile> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const machine = await assertMachineInTenant(
        client,
        actor.tenantId,
        machineId,
      );
      const rows = await historyEntriesRepository.listHistoryEntries(
        client,
        actor.tenantId,
        machineId,
        {
          entryType: query.type,
          from: query.from,
          to: query.to,
          authorId: query.author,
        },
      );
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'create',
        entityType: 'machine_history_export',
        entityId: machineId,
        metadata: { format: query.format, entries: rows.length },
      });
      const fileName = `history-${machine.label.replace(/[^\w.-]+/g, '_')}.${query.format}`;
      return query.format === 'csv'
        ? {
            body: toHistoryCsv(rows),
            contentType: 'text/csv; charset=utf-8',
            fileName,
          }
        : {
            body: await toHistoryPdf(
              rows,
              `${machine.manufacturer_name} ${machine.model_name} · ${machine.label}`,
            ),
            contentType: 'application/pdf',
            fileName,
          };
    });
}
