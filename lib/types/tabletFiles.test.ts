import { describe, expect, it } from "vitest";
import { addTabletFiles, MAX_TABLET_FILE_BYTES, tabletFilesProblem } from "./tabletFiles";

const file = (name: string, size = 1) => ({ name, size });

describe("tabletFilesProblem", () => {
  it("accepts files inside the limits", () => {
    expect(tabletFilesProblem([file("a.dxf", MAX_TABLET_FILE_BYTES)])).toBeNull();
  });

  it("names the file or total that is over", () => {
    expect(tabletFilesProblem([file("big.bin", MAX_TABLET_FILE_BYTES + 1)])).toBe("big.bin is over 5 MB.");
    expect(tabletFilesProblem([file("empty.txt", 0)])).toBe("empty.txt is empty or is a folder.");
    expect(tabletFilesProblem(Array.from({ length: 33 }, (_, index) => file(`${index}`)))).toBe("Send up to 32 files at a time.");
    expect(tabletFilesProblem(Array.from({ length: 5 }, (_, index) => file(`${index}`, MAX_TABLET_FILE_BYTES)))).toBe(
      "One send can be up to 20 MB in total.",
    );
  });
});

describe("addTabletFiles", () => {
  it("replaces a file of the same name, ignoring case", () => {
    expect(addTabletFiles([file("A.txt", 1)], [file("a.txt", 2), file("b.txt")])).toEqual([file("a.txt", 2), file("b.txt")]);
  });
});
