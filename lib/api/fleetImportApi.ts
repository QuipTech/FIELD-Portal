import { apiDownloadRequest, apiRequest } from "./httpClient";
import type { FleetImportResult, ImportedMachine } from "../types/fleetImport";

// Machines → Import CSV (machine.create). The portal reads the file and
// sends its rows as JSON.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const FLEET_IMPORT_TEMPLATE_FILE_NAME = "fleet-import-template.csv";

export const MAX_IMPORT_ROWS = 1000;

export const downloadFleetImportTemplateRequest = async (accessToken: string) =>
  (await apiDownloadRequest("/machines/import/template", { headers: authorizationHeader(accessToken) })).blob;

// dryRun checks every row and saves nothing. Otherwise every row is saved,
// or none if any row has an error (400).
export const importFleetRequest = (accessToken: string, rows: ImportedMachine[], dryRun: boolean) =>
  apiRequest<FleetImportResult>("/machines/import", {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify({ rows, dryRun }),
  });
