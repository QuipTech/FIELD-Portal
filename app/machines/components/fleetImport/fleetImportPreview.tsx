import type { FleetImportResult } from "@/lib/types/fleetImport";

// The dry run's verdict on every row: its errors, or the group it goes in.
export const FleetImportPreview = ({ result }: { result: FleetImportResult }) => {
  const rowsWithErrors = result.rows.filter((row) => row.errors.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {rowsWithErrors.length > 0 ? (
        <p className="rounded-lg bg-dangerTint p-3 text-sm text-danger">
          {rowsWithErrors.length} of {result.rows.length} rows need fixing. Nothing is imported until every row is
          right: fix the file and choose it again.
        </p>
      ) : (
        <p className="rounded-lg bg-primaryTint p-3 text-sm text-primaryTintText">
          All {result.rows.length} machines are ready to import.
        </p>
      )}
      <ul className="flex max-h-[320px] flex-col divide-y divide-borderGray overflow-y-auto rounded-xl border border-borderGray">
        {result.rows.map((row) => (
          <li key={row.row} className="flex items-start gap-3 px-3.5 py-2 text-sm">
            <span className="w-12 flex-none text-mutedGray">Row {row.row}</span>
            <span className="w-36 flex-none truncate font-mono text-ink">{row.serialNumber ?? "—"}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {row.errors.length > 0 ? (
                row.errors.map((error) => (
                  <span key={error} className="text-danger">
                    {error}
                  </span>
                ))
              ) : (
                <span className="text-bodyGray">Ready</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
