"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { ImportModelTreePayload, ImportTreeMode } from "@/lib/types/machineLibrary";
import { parseImportedTree } from "../parseImportedTree";

interface ImportTreeModalProps {
  modelName: string;
  onImport: (payload: ImportModelTreePayload) => Promise<void>;
  onClose: () => void;
}

const IMPORT_FAILED_MESSAGE = "Couldn't import the tree. Please try again.";
const EXAMPLE = "Powertrain, Engine — C175-16\nPowertrain, Torque converter\nHydraulics";

const MODE_OPTIONS: { mode: ImportTreeMode; label: string }[] = [
  { mode: "merge", label: "Add to the existing tree" },
  { mode: "replace", label: "Replace the existing tree" },
];

export const ImportTreeModal = ({ modelName, onImport, onClose }: ImportTreeModalProps) => {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ImportTreeMode>("merge");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setText(await file.text());
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setImportError(null);
    let systems: ImportModelTreePayload["systems"];
    try {
      systems = parseImportedTree(text);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : IMPORT_FAILED_MESSAGE);
      return;
    }
    setIsImporting(true);
    try {
      await onImport({ mode, systems });
      onClose();
    } catch (error) {
      setImportError(toApiErrorMessage(error, IMPORT_FAILED_MESSAGE));
      setIsImporting(false);
    }
  };

  return (
    <Modal title={`Import tree — ${modelName}`} onClose={isImporting ? undefined : onClose} widthClassName="w-[520px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <span className="text-xs text-mutedGray">
          One &ldquo;System, Component&rdquo; per line (a spreadsheet saved as CSV), or JSON like{" "}
          <code>[{`{ "name": "Brakes", "components": ["Caliper"] }`}]</code>.
        </span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={EXAMPLE}
          rows={8}
          className="rounded-lg border border-borderGrayStrong bg-surface p-3 font-mono text-[13px] text-ink outline-none placeholder:text-mutedGray"
        />
        <input type="file" accept=".csv,.txt,.json" onChange={loadFile} className="text-xs text-bodyGray" />
        <div className="flex flex-col gap-1.5">
          {MODE_OPTIONS.map((option) => (
            <label key={option.mode} className="flex items-center gap-2 text-sm text-bodyGray">
              <input type="radio" name="importMode" checked={mode === option.mode} onChange={() => setMode(option.mode)} />
              {option.label}
            </label>
          ))}
        </div>
        {importError && <span className="text-xs text-danger">{importError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="ml-auto" disabled={!text.trim() || isImporting}>
            {isImporting ? "Importing…" : "Import"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
