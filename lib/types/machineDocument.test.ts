import { describe, expect, it } from "vitest";
import { formatFileSize } from "../format/fileSize";
import { documentTypeForEntry } from "./machineDocument";

describe("documentTypeForEntry", () => {
  it("files service and inspection entries under their own type", () => {
    expect(documentTypeForEntry("service")).toBe("service_report");
    expect(documentTypeForEntry("inspection")).toBe("inspection");
  });

  it("files everything else as other", () => {
    expect(documentTypeForEntry("repair")).toBe("other");
    expect(documentTypeForEntry("fault")).toBe("other");
    expect(documentTypeForEntry("note")).toBe("other");
  });
});

describe("formatFileSize", () => {
  it("never shows 0 KB, and uses MB from 1 MB", () => {
    expect(formatFileSize(5)).toBe("1 KB");
    expect(formatFileSize(840 * 1024)).toBe("840 KB");
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe("2.4 MB");
  });
});
