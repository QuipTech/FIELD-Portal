"use client";

import { useState } from "react";
import { parseCsvText } from "@/lib/format/parseCsvText";
import { importFleetRequest, MAX_IMPORT_ROWS } from "@/lib/api/fleetImportApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { FleetImportResult, ImportedMachineField } from "@/lib/types/fleetImport";
import { guessColumnMapping, toImportedMachines, type FleetColumnMapping } from "./fleetImportColumns";

export interface FleetImportFile {
  name: string;
  headers: string[];
  dataRows: string[][];
}

// Machines → Import CSV, step by step: read the file, map its columns,
// check every row with a dry run, then import them all (or none).
export const useFleetImport = () => {
  const [file, setFile] = useState<FleetImportFile | null>(null);
  const [mapping, setMapping] = useState<FleetColumnMapping | null>(null);
  const [preview, setPreview] = useState<FleetImportResult | null>(null);
  const [imported, setImported] = useState<FleetImportResult | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readFile = async (chosen: File) => {
    setError(null);
    const [headers, ...dataRows] = parseCsvText(await chosen.text());
    if (!headers || dataRows.length === 0) return setError("The file has no machines. Put the column names on the first line.");
    if (dataRows.length > MAX_IMPORT_ROWS) return setError(`A file can hold up to ${MAX_IMPORT_ROWS} machines; this one has ${dataRows.length}.`);
    setFile({ name: chosen.name, headers, dataRows });
    setMapping(guessColumnMapping(headers));
  };

  const chooseColumn = (field: ImportedMachineField, columnIndex: number | null) =>
    setMapping((current) => current && { ...current, [field]: columnIndex });

  const send = async (dryRun: boolean) => {
    if (!file || !mapping) return;
    setIsWorking(true);
    setError(null);
    try {
      const result = await importFleetRequest(requireAccessToken(), toImportedMachines(file.dataRows, mapping), dryRun);
      if (dryRun) setPreview(result);
      else setImported(result);
    } catch (sendError) {
      setError(toApiErrorMessage(sendError, "Couldn't import the machines. Please try again."));
    } finally {
      setIsWorking(false);
    }
  };

  const backToMapping = () => {
    setPreview(null);
    setError(null);
  };

  const startOver = () => {
    setFile(null);
    setMapping(null);
    setPreview(null);
    setError(null);
  };

  return {
    file,
    mapping,
    preview,
    imported,
    isWorking,
    error,
    readFile,
    chooseColumn,
    checkRows: () => send(true),
    importRows: () => send(false),
    backToMapping,
    startOver,
  };
};
