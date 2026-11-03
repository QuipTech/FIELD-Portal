"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { downloadFleetImportTemplateRequest, FLEET_IMPORT_TEMPLATE_FILE_NAME, MAX_IMPORT_ROWS } from "@/lib/api/fleetImportApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { saveBlobAsFile } from "@/lib/format/saveBlobAsFile";

interface FleetImportFilePickerProps {
  onFileChosen: (file: File) => void;
}

// The first step: download the template, or choose a CSV file.
export const FleetImportFilePicker = ({ onFileChosen }: FleetImportFilePickerProps) => {
  const [templateError, setTemplateError] = useState<string | null>(null);

  const downloadTemplate = async () => {
    setTemplateError(null);
    try {
      saveBlobAsFile(await downloadFleetImportTemplateRequest(requireAccessToken()), FLEET_IMPORT_TEMPLATE_FILE_NAME);
    } catch (error) {
      setTemplateError(toApiErrorMessage(error, "Couldn't download the template. Please try again."));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-bodyGray">
        One machine per row, up to {MAX_IMPORT_ROWS}. Serial number, make and model are required; make and model must
        match the Machine library.
      </p>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-borderGrayStrong bg-surfaceGray px-6 py-8 text-center hover:bg-fillGray">
        <Icon name="upload" className="h-5 w-5 stroke-mutedGray" />
        <span className="text-[15px] font-medium text-ink">Choose a CSV file</span>
        <span className="text-xs text-mutedGray">Save your spreadsheet as CSV first</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) onFileChosen(chosen);
            event.target.value = "";
          }}
        />
      </label>
      <button type="button" onClick={downloadTemplate} className="flex w-fit items-center gap-1.5 text-sm text-primary hover:underline">
        <Icon name="download" className="h-4 w-4" />
        Download the template
      </button>
      {templateError && <span className="text-xs text-danger">{templateError}</span>}
    </div>
  );
};
