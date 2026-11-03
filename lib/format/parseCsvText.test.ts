import { describe, expect, it } from "vitest";
import { parseCsvText } from "./parseCsvText";

describe("parseCsvText", () => {
  it("splits rows and cells", () => {
    expect(parseCsvText("a,b\n1,2\r\n3,4")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });

  it("reads quoted cells with commas, quotes and line breaks", () => {
    expect(parseCsvText('name,notes\n"ABC, Ltd","said ""hi""\nthen left"')).toEqual([
      ["name", "notes"],
      ["ABC, Ltd", 'said "hi"\nthen left'],
    ]);
  });

  it("drops blank lines and the byte order mark Excel adds", () => {
    expect(parseCsvText("﻿a,b\n\n1,2\n,\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("keeps empty cells in place", () => {
    expect(parseCsvText("a,,c")).toEqual([["a", "", "c"]]);
  });
});
