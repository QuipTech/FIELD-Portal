"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { hasRequiredColumns } from "./fleetImportColumns";
import { FleetImportFilePicker } from "./fleetImportFilePicker";
import { FleetImportColumnMapping } from "./fleetImportColumnMapping";
import { FleetImportPreview } from "./fleetImportPreview";
import { useFleetImport } from "./useFleetImport";

interface FleetImportModalProps {
  onImported: () => void;
  onClose: () => void;
}

const countMachines = (count: number) => `${count} machine${count === 1 ? "" : "s"}`;

// Machines → Import CSV: choose a file, map its columns, check it, import.
export const FleetImportModal = ({ onImported, onClose }: FleetImportModalProps) => {
  const fleetImport = useFleetImport();
  const { file, mapping, preview, imported, isWorking, error } = fleetImport;
  const canImport = Boolean(preview) && preview!.rows.every((row) => row.errors.length === 0);

  const finish = () => {
    onImported();
    onClose();
  };

  if (imported) {
    return (
      <Modal title="Import machines" onClose={finish} widthClassName="w-[560px]">
        <div className="flex flex-col gap-3.5 p-5">
          <p className="text-sm text-bodyGray">
            {countMachines(imported.imported)} imported. They start as Not
            active; activate them from the Machines list when you&apos;re ready to bill them.
          </p>
          <Button variant="primary" className="ml-auto" onClick={finish}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Import machines" onClose={isWorking ? undefined : onClose} widthClassName="w-[640px]">
      <div className="flex flex-col gap-3.5 p-5">
        {!file || !mapping ? (
          <FleetImportFilePicker onFileChosen={fleetImport.readFile} />
        ) : (
          <>
            <p className="text-sm text-bodyGray">
              <span className="font-medium text-ink">{file.name}</span> · {countMachines(file.dataRows.length)}
            </p>
            {preview ? (
              <FleetImportPreview result={preview} />
            ) : (
              <FleetImportColumnMapping headers={file.headers} mapping={mapping} onChange={fleetImport.chooseColumn} />
            )}
          </>
        )}
        {error && <span className="text-xs text-danger">{error}</span>}
        {file && mapping && (
          <div className="flex">
            <Button variant="ghost" disabled={isWorking} onClick={preview ? fleetImport.backToMapping : fleetImport.startOver}>
              {preview ? "Back" : "Choose another file"}
            </Button>
            {preview ? (
              <Button variant="primary" className="ml-auto" disabled={isWorking || !canImport} onClick={fleetImport.importRows}>
                {isWorking ? "Importing…" : `Import ${countMachines(file.dataRows.length)}`}
              </Button>
            ) : (
              <Button variant="primary" className="ml-auto" disabled={isWorking || !hasRequiredColumns(mapping)} onClick={fleetImport.checkRows}>
                {isWorking ? "Checking…" : "Check rows"}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
