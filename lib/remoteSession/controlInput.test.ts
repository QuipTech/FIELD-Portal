import { describe, expect, it } from "vitest";
import { shouldSendKey, toKeyMessage, toScreenPoint } from "./controlInput";

describe("toScreenPoint", () => {
  const box = { left: 100, top: 50, width: 1000, height: 500 };

  it("maps a point inside a letterboxed 16:10 stream to fractions", () => {
    // 1280x800 shown at 800x500, centred: 100 px bars on each side.
    expect(toScreenPoint(100 + 100, 50, box, 1280, 800)).toEqual({ x: 0, y: 0 });
    expect(toScreenPoint(100 + 500, 50 + 250, box, 1280, 800)).toEqual({ x: 0.5, y: 0.5 });
    expect(toScreenPoint(100 + 900, 50 + 500, box, 1280, 800)).toEqual({ x: 1, y: 1 });
  });

  it("clamps a held pointer to the screen edge when it leaves the displayed image", () => {
    expect(toScreenPoint(1300, 25, box, 1280, 800, true)).toEqual({ x: 1, y: 0 });
    expect(toScreenPoint(150, 300, box, 1280, 800, true)).toEqual({ x: 0, y: 0.5 });
  });

  it("ignores the bars and a video without a size", () => {
    expect(toScreenPoint(100 + 50, 50 + 250, box, 1280, 800)).toBeNull();
    expect(toScreenPoint(500, 300, box, 0, 0)).toBeNull();
  });
});

describe("keys", () => {
  it("keeps the browser's own close and reload shortcuts", () => {
    expect(shouldSendKey({ key: "w", ctrlKey: true, metaKey: false })).toBe(false);
    expect(shouldSendKey({ key: "F5", ctrlKey: false, metaKey: false })).toBe(false);
    expect(shouldSendKey({ key: "c", ctrlKey: true, metaKey: false })).toBe(true);
    expect(shouldSendKey({ key: "Enter", ctrlKey: false, metaKey: false })).toBe(true);
  });

  it("describes a key with its modifiers", () => {
    expect(
      toKeyMessage("down", { key: "A", code: "KeyA", altKey: false, ctrlKey: false, shiftKey: true, metaKey: false }),
    ).toEqual({ v: 1, type: "key", action: "down", key: "A", code: "KeyA", alt: false, ctrl: false, shift: true, meta: false });
  });
});
