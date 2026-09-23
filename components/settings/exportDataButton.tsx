"use client";

import { Button } from "@/components/ui/button";

const EXPORT_FILE_PATH = "/files/quiptechFieldDataExport.pdf";
const EXPORT_FILE_NAME = "quiptech-field-data-export.pdf";

export const ExportDataButton = () => {
  const handleExport = () => {
    const link = document.createElement("a");
    link.href = EXPORT_FILE_PATH;
    link.download = EXPORT_FILE_NAME;
    link.click();
  };

  return (
    <Button size="sm" onClick={handleExport}>
      Request export
    </Button>
  );
};
