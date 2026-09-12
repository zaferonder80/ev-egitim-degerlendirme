import { describe, expect, it } from "vitest";
import { formatScoreValue } from "../shared/score";

describe("formatScoreValue", () => {
  it("yüzde bazlı skorları 100 üzerinden gösterir", () => {
    expect(formatScoreValue(34)).toBe("34 / 100");
    expect(formatScoreValue(48.5)).toBe("48.5 / 100");
  });
});
