import { describe, expect, it } from "vitest";
import { formatFieldId, isFieldId, normaliseFieldId } from "./machineAppConnection";

describe("FIELD ID", () => {
  it("is shown in groups of three", () => {
    expect(formatFieldId("482915307")).toBe("482 915 307");
  });

  it("accepts spaces and dashes, and needs 9 digits", () => {
    expect(normaliseFieldId("482 915-307")).toBe("482915307");
    expect(isFieldId("482 915 307")).toBe(true);
    expect(isFieldId("48291530")).toBe(false);
  });
});
