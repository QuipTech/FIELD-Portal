"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { PAGE_SIZE, useAuditLog } from "../useAuditLog";
import { AuditLogFilterBar } from "./auditLogFilterBar";
import { AuditLogTable } from "./auditLogTable";

const EXPORT_FAILED_MESSAGE = "Couldn't export the audit log. Please try again.";
const EXPORT_TRUNCATED_MESSAGE = "Export holds the newest 20,000 events only. Narrow the filters to export the rest.";

export const AuditLogManager = () => {
  const auditLog = useAuditLog();
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const { events } = auditLog;
  const pageCount = events ? Math.max(1, Math.ceil(events.total / PAGE_SIZE)) : 1;

  const handleExport = async () => {
    setIsExporting(true);
    setExportNotice(null);
    try {
      const isTruncated = await auditLog.exportCsv();
      if (isTruncated) setExportNotice(EXPORT_TRUNCATED_MESSAGE);
    } catch (error) {
      setExportNotice(toApiErrorMessage(error, EXPORT_FAILED_MESSAGE));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-[22px] font-medium text-ink">Audit log</h1>
        <Button className="ml-auto" onClick={handleExport} disabled={isExporting || !events?.total}>
          <Icon name="download" />
          {isExporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
      {exportNotice && <span className="text-xs text-danger">{exportNotice}</span>}
      <AuditLogFilterBar
        options={auditLog.filterOptions}
        actorId={auditLog.actorId}
        onActorChange={auditLog.setActorId}
        eventType={auditLog.eventType}
        onEventTypeChange={auditLog.setEventType}
        range={auditLog.range}
        onRangeChange={auditLog.setRange}
        total={events?.total ?? null}
      />
      {auditLog.isLoading && !events && (
        <span className="flex items-center gap-2 p-10 text-sm text-mutedGray">
          <LoadingSpinner /> Loading audit log…
        </span>
      )}
      {auditLog.loadError && <span className="text-sm text-danger">{auditLog.loadError}</span>}
      {events && <AuditLogTable events={events.items} />}
      {events && pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-mutedGray">
          <Button size="sm" onClick={() => auditLog.setPage(auditLog.page - 1)} disabled={auditLog.page <= 1}>
            Previous
          </Button>
          <span>
            Page {auditLog.page} of {pageCount}
          </span>
          <Button size="sm" onClick={() => auditLog.setPage(auditLog.page + 1)} disabled={auditLog.page >= pageCount}>
            Next
          </Button>
        </div>
      )}
    </>
  );
};
