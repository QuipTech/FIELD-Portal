import { describe, expect, it } from "vitest";
import { guessColumnMapping, hasRequiredColumns, toImportedMachines } from "./fleetImportColumns";

const TEMPLATE_HEADERS = ["serial_number", "make", "model", "plant_id", "site", "operating_hours", "status"];

describe("guessColumnMapping", () => {
  it("matches the template's headers", () => {
    const mapping = guessColumnMapping(TEMPLATE_HEADERS);
    expect(mapping).toEqual({ serialNumber: 0, make: 1, model: 2, plantId: 3, site: 4, operatingHours: 5, status: 6 });
    expect(hasRequiredColumns(mapping)).toBe(true);
  });

  it("matches other spellings and leaves unknown columns out", () => {
    const mapping = guessColumnMapping(["Serial No", "Manufacturer", "Model", "Customer", "Colour"]);
    expect(mapping).toMatchObject({ serialNumber: 0, make: 1, model: 2, site: null, plantId: null });
  });

  it("reports a missing required column", () => {
    expect(hasRequiredColumns(guessColumnMapping(["serial", "make"]))).toBe(false);
  });
});

describe("toImportedMachines", () => {
  it("maps cells to fields and leaves blank ones out", () => {
    const mapping = guessColumnMapping(TEMPLATE_HEADERS);
    expect(toImportedMachines([["SN1", "CAT", "793F", "", " Pit 4 ", "12,450", ""]], mapping)).toEqual([
      { serialNumber: "SN1", make: "CAT", model: "793F", site: "Pit 4", operatingHours: "12,450" },
    ]);
  });

  it("treats a short row's missing cells as blank", () => {
    expect(toImportedMachines([["SN2"]], guessColumnMapping(TEMPLATE_HEADERS))).toEqual([{ serialNumber: "SN2" }]);
  });
});
