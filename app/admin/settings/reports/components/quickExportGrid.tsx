"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/iconTile";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { exportReportRequest } from "@/lib/api/adminReportsApi";
import { saveBlobAsFile } from "@/lib/format/saveBlobAsFile";
import type { ReportType } from "@/lib/types/adminReports";
import { REPORT_CATALOG } from "../reportCatalog";

const EXPORT_FAILED_MESSAGE = "Couldn't export. Please try again.";

export const QuickExportGrid = () => {
  const [exportingType, setExportingType] = useState<ReportType | null>(null);
  const [notes, setNotes] = useState<Partial<Record<ReportType, { text: string; isError: boolean }>>>({});

  const exportReport = async (reportType: ReportType) => {
    setExportingType(reportType);
    setNotes((current) => ({ ...current, [reportType]: undefined }));
    try {
      const { blob, fileName, isTruncated } = await exportReportRequest(requireAccessToken(), reportType);
      saveBlobAsFile(blob, fileName);
      if (isTruncated) {
        setNotes((current) => ({
          ...current,
          [reportType]: { text: "Only the most recent events fit in one export.", isError: false },
        }));
      }
    } catch (error) {
      setNotes((current) => ({
        ...current,
        [reportType]: { text: toApiErrorMessage(error, EXPORT_FAILED_MESSAGE), isError: true },
      }));
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
      {REPORT_CATALOG.map((item) => {
        const note = notes[item.type];
        return (
          <div key={item.type} className="flex flex-col gap-3.5 rounded-2xl border border-slate-200/80 bg-surface p-5">
            <IconTile icon={item.icon} />
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-slate-900">{item.title}</span>
              <span className="text-xs text-mutedGray">{item.caption}</span>
            </div>
            <Button
              className="mt-auto w-full"
              onClick={() => exportReport(item.type)}
              disabled={exportingType !== null}
            >
              <Icon name="download" className="h-3.5 w-3.5" />
              {exportingType === item.type ? "Exporting…" : "Export CSV"}
            </Button>
            {note && <span className={`text-xs ${note.isError ? "text-danger" : "text-mutedGray"}`}>{note.text}</span>}
          </div>
        );
      })}
    </div>
  );
};
