import { describe, expect, it } from "vitest";
import { audMoney } from "./audMoney";

describe("AUD cents display", () => {
  it.each([[4900, "A$49.00"], [5390, "A$53.90"], [75400, "A$754.00"], [0, "A$0.00"], [1, "A$0.01"], [1247500, "A$12,475.00"]])(
    "formats %s cents as %s", (cents, expected) => expect(audMoney(Number(cents))).toBe(expected),
  );
});
